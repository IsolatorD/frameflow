import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { totalmem } from "node:os";
import { join } from "node:path";
import {
	AI_PROVIDERS,
	type AiProviderId,
	type AiSettings,
	type AiSettingsView,
	type ApiKeyState,
	aiSettingsSchema,
	type CloudProviderId,
	defaultAiSettings,
	defaultLocalModel,
	isCloudProvider,
	type KeyStorage,
	keyHint,
	recommendLocalModel,
	type SystemInfo,
	systemInfoFrom,
} from "@frameflow/core/ai/catalog";
import { type ConfiguredLlm, createCloudLlm, createLlm } from "@frameflow/core/ai/providers";
import { type LlmStatus, OllamaProvider } from "@frameflow/core/script/ai";
import { safeStorage } from "electron";
import { z } from "zod";
import type { LocalAi } from "./localAi/localAi";

// Ajustes de IA en la carpeta de datos. Las claves de API van en otro archivo, cifradas con el
// almacén del sistema (Llavero en macOS, DPAPI en Windows, libsecret/KWallet en Linux).
// La interfaz nunca recibe una clave: solo si existe y sus últimos 4 caracteres.

const CLOUD = AI_PROVIDERS.filter(isCloudProvider);
const keysFileSchema = z.partialRecord(z.enum(CLOUD as [CloudProviderId]), z.string());
const keyInput = z
	.string()
	.trim()
	.min(8, "La clave es demasiado corta")
	.max(400, "La clave es demasiado larga")
	.refine((k) => !/\s/.test(k), "La clave no puede tener espacios");

export type AiSettingsStore = ReturnType<typeof createAiSettingsStore>;

export function createAiSettingsStore(opts: {
	dataDir: string;
	defaultOllamaModel?: string;
	localAi: LocalAi;
}) {
	const settingsFile = join(opts.dataDir, "ai-settings.json");
	const keysFile = join(opts.dataDir, "ai-keys.json");

	const readJson = (file: string): unknown => {
		if (!existsSync(file)) return undefined;
		try {
			return JSON.parse(readFileSync(file, "utf8"));
		} catch {
			return undefined; // archivo dañado: se vuelve a los valores por defecto
		}
	};

	const system = (): SystemInfo =>
		systemInfoFrom({ platform: process.platform, arch: process.arch, totalBytes: totalmem() });

	const getSettings = (): AiSettings => {
		const parsed = aiSettingsSchema.safeParse(readJson(settingsFile));
		// Sin elección guardada: el modelo recomendado para este equipo (FRAMEFLOW_MODEL lo fija en pruebas).
		return parsed.success
			? parsed.data
			: defaultAiSettings(opts.defaultOllamaModel ?? defaultLocalModel(system()));
	};

	const readKeys = () => keysFileSchema.catch({}).parse(readJson(keysFile) ?? {});

	const keyStorage = (): KeyStorage => {
		if (!safeStorage.isEncryptionAvailable()) return "unavailable";
		// En Linux sin llavero, Electron "cifra" con una clave fija: se avisa en la interfaz.
		if (process.platform === "linux" && safeStorage.getSelectedStorageBackend() === "basic_text")
			return "weak";
		return "secure";
	};

	const getKey = (provider: CloudProviderId): string | null => {
		const stored = readKeys()[provider];
		if (!stored || keyStorage() === "unavailable") return null;
		try {
			return safeStorage.decryptString(Buffer.from(stored, "base64"));
		} catch {
			return null; // cifrada en otro equipo o con otro usuario: hay que volver a pegarla
		}
	};

	const ollama = (model: string) => new OllamaProvider(model, opts.localAi.url());
	const LOCAL_MISSING = "La IA local no está preparada: en Ajustes puedes descargarla con un clic.";

	return {
		getSettings,

		saveSettings(input: unknown): AiSettings {
			const settings = aiSettingsSchema.parse(input);
			writeFileSync(settingsFile, `${JSON.stringify(settings, null, "\t")}\n`);
			return settings;
		},

		/** Guarda (o borra con null) la clave de un proveedor en la nube. */
		setKey(provider: unknown, key: unknown): void {
			const id = z.enum(CLOUD as [CloudProviderId]).parse(provider);
			const keys = readKeys();
			if (key === null) {
				delete keys[id];
			} else {
				const value = keyInput.parse(key);
				if (keyStorage() === "unavailable")
					throw new Error(
						"Este sistema no permite guardar claves cifradas. Instala un llavero (GNOME Keyring o KWallet) y vuelve a intentarlo.",
					);
				keys[id] = safeStorage.encryptString(value).toString("base64");
			}
			writeFileSync(keysFile, `${JSON.stringify(keys, null, "\t")}\n`, { mode: 0o600 });
		},

		async view(): Promise<AiSettingsView> {
			const info = system();
			const local = await opts.localAi.detect();
			const keys = Object.fromEntries(
				CLOUD.map((id): [CloudProviderId, ApiKeyState] => {
					const key = getKey(id);
					return [id, key ? { set: true, hint: keyHint(key) } : { set: false }];
				}),
			) as Record<CloudProviderId, ApiKeyState>;
			return {
				settings: getSettings(),
				keys,
				keyStorage: keyStorage(),
				system: info,
				recommendation: recommendLocalModel(info),
				ollamaModels: local.url
					? await ollama(getSettings().models.ollama).installedModels()
					: null,
				local,
			};
		},

		/** El proveedor elegido ahora mismo (se crea en cada uso: los ajustes pueden cambiar). */
		async current(): Promise<ConfiguredLlm> {
			const settings = getSettings();
			if (isCloudProvider(settings.provider)) return createLlm(settings, getKey(settings.provider));
			if (!(await opts.localAi.ensure())) {
				const name = "IA local";
				return {
					name,
					status: async () => ({ available: false, name, reason: LOCAL_MISSING }),
					generateJson: async () => {
						throw new Error(LOCAL_MISSING);
					},
				};
			}
			return createLlm(settings, null, opts.localAi.url());
		},

		/** Prueba un proveedor y modelo concretos con la clave guardada (sin gastar tokens). */
		async test(provider: unknown, model: unknown): Promise<LlmStatus> {
			const id = z.enum(AI_PROVIDERS as unknown as [AiProviderId]).parse(provider);
			const name = z.string().trim().min(1, "Elige un modelo").parse(model);
			if (!isCloudProvider(id)) {
				if (!(await opts.localAi.ensure()))
					return { available: false, name, reason: LOCAL_MISSING };
				return ollama(name).status();
			}
			const key = getKey(id);
			if (!key) return { available: false, name, reason: "Primero guarda la clave de API." };
			return createCloudLlm(id, name, key).test();
		},
	};
}

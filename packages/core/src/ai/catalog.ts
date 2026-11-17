import { z } from "zod";
import type { LocalAiState } from "./localRuntime";

// Proveedores de IA para escribir guiones. Este archivo no importa ningún SDK: lo usan tanto el
// proceso principal (que llama a la IA) como la interfaz (que muestra los ajustes).

export const AI_PROVIDERS = ["ollama", "anthropic", "openai", "gemini"] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];
export type CloudProviderId = Exclude<AiProviderId, "ollama">;

export const isCloudProvider = (id: AiProviderId): id is CloudProviderId => id !== "ollama";

export const QWEN3_8B = "hf.co/unsloth/Qwen3-8B-GGUF:Q4_K_M";
export const QWEN3_14B = "hf.co/unsloth/Qwen3-14B-GGUF:Q4_K_M";

export type ModelOption = {
	id: string;
	label: string;
	/** Una línea para ayudar a elegir (velocidad, calidad, coste). */
	note: string;
	/** Solo modelos locales: GB de descarga y de RAM aproximada al generar. */
	sizeGb?: number;
	ramGb?: number;
};

export type ProviderInfo = {
	id: AiProviderId;
	label: string;
	description: string;
	/** Dónde crear la clave de API (solo proveedores en la nube). */
	keyUrl?: string;
	/** Prefijo típico de la clave, para avisar de pegados equivocados. */
	keyPrefix?: string;
	models: readonly ModelOption[];
	defaultModel: string;
};

export const PROVIDERS: Record<AiProviderId, ProviderInfo> = {
	ollama: {
		id: "ollama",
		label: "En este equipo (Ollama)",
		description: "Gratis y privado: nada sale de tu equipo. Más lento y con algún dato inventado.",
		models: [
			{
				id: QWEN3_8B,
				label: "Qwen3 8B",
				note: "Rápido (~3 min por guion). Para equipos con 8–16 GB de RAM.",
				sizeGb: 5,
				ramGb: 6,
			},
			{
				id: QWEN3_14B,
				label: "Qwen3 14B",
				note: "Mejores datos y mejor redacción (~5 min por guion). Pide 16 GB de RAM o más.",
				sizeGb: 9,
				ramGb: 10,
			},
		],
		defaultModel: QWEN3_8B,
	},
	anthropic: {
		id: "anthropic",
		label: "Claude (Anthropic)",
		description: "En la nube con tu clave de API. Pago por uso.",
		keyUrl: "https://platform.claude.com/settings/keys",
		keyPrefix: "sk-ant-",
		models: [
			{ id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "El más capaz." },
			{ id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "Muy bueno y más barato." },
			{ id: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "El más rápido y económico." },
		],
		defaultModel: "claude-opus-5-5",
	},
	openai: {
		id: "openai",
		label: "OpenAI",
		description: "En la nube con tu clave de API. Pago por uso.",
		keyUrl: "https://platform.openai.com/api-keys",
		keyPrefix: "sk-",
		models: [
			{ id: "gpt-6-astra", label: "GPT-6 Astra", note: "El más capaz." },
			{ id: "gpt-6.1-sol", label: "GPT-6.1 Sol", note: "Equilibrio entre calidad y coste." },
			{ id: "gpt-6-luna", label: "GPT-6 Luna", note: "El más económico." },
		],
		defaultModel: "gpt-6.1-sol",
	},
	gemini: {
		id: "gemini",
		label: "Gemini (Google)",
		description: "En la nube con tu clave de API de Google AI Studio.",
		keyUrl: "https://aistudio.google.com/apikey",
		keyPrefix: "AIza",
		models: [
			{ id: "gemini-4-argon", label: "Gemini 4 Argon", note: "El más capaz." },
			{ id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", note: "Rápido y económico." },
		],
		defaultModel: "gemini-3.8-flash",
	},
};

/** Ajustes de IA guardados (las claves van aparte, cifradas por el sistema). */
export const aiSettingsSchema = z.object({
	provider: z.enum(AI_PROVIDERS),
	/** Modelo elegido en cada proveedor (se recuerda al cambiar de uno a otro). */
	models: z.object({
		ollama: z.string().min(1),
		anthropic: z.string().min(1),
		openai: z.string().min(1),
		gemini: z.string().min(1),
	}),
});
export type AiSettings = z.infer<typeof aiSettingsSchema>;

export const defaultAiSettings = (ollamaModel: string = QWEN3_8B): AiSettings => ({
	provider: "ollama",
	models: {
		ollama: ollamaModel,
		anthropic: PROVIDERS.anthropic.defaultModel,
		openai: PROVIDERS.openai.defaultModel,
		gemini: PROVIDERS.gemini.defaultModel,
	},
});

/** Nombre corto para mostrar: "Claude Opus 5.5", "Qwen3 14B" o el ID si es uno propio. */
export const modelLabel = (provider: AiProviderId, model: string) =>
	PROVIDERS[provider].models.find((m) => m.id === model)?.label ?? model;

export type SystemInfo = {
	platform: "darwin" | "win32" | "linux" | string;
	arch: string;
	ramGb: number;
};

export type LocalRecommendation =
	| { kind: "model"; model: string; reason: string }
	| { kind: "cloud"; reason: string };

/**
 * Qué modelo local conviene según el equipo. En Mac con Apple Silicon la GPU integrada acelera
 * el modelo; en Windows/Linux depende de la tarjeta gráfica, que no se detecta: se avisa.
 */
export function recommendLocalModel(system: SystemInfo): LocalRecommendation {
	const appleSilicon = system.platform === "darwin" && system.arch === "arm64";
	const gpuNote = appleSilicon
		? ""
		: " Sin tarjeta gráfica dedicada (NVIDIA o AMD) puede ser muy lento.";
	if (system.ramGb < 8) {
		return {
			kind: "cloud",
			reason: `Tu equipo tiene ${system.ramGb} GB de RAM: un modelo local no cabe con holgura. Usa un proveedor en la nube.`,
		};
	}
	if (system.ramGb >= 16) {
		return {
			kind: "model",
			model: QWEN3_14B,
			reason: `Con ${system.ramGb} GB de RAM puedes usar el 14B, que inventa menos datos.${gpuNote}`,
		};
	}
	return {
		kind: "model",
		model: QWEN3_8B,
		reason: `Con ${system.ramGb} GB de RAM el 8B es el que cabe con holgura.${gpuNote}`,
	};
}

/** Aviso si la clave pegada no tiene el formato habitual del proveedor (no bloquea). */
export function keyWarning(provider: CloudProviderId, key: string): string | null {
	const prefix = PROVIDERS[provider].keyPrefix;
	if (!prefix || key.trim().startsWith(prefix)) return null;
	return `Las claves de ${PROVIDERS[provider].label} suelen empezar por "${prefix}". Revisa que la hayas copiado bien.`;
}

/** Lo que la interfaz ve de una clave: nunca la clave, solo si existe y sus últimos caracteres. */
export type ApiKeyState = { set: false } | { set: true; hint: string };

export const keyHint = (key: string) => `…${key.trim().slice(-4)}`;

/** Cómo guarda el sistema las claves: "weak" en Linux sin llavero (se avisa). */
export type KeyStorage = "secure" | "weak" | "unavailable";

/** Todo lo que la pantalla de ajustes necesita (sin claves). */
export type AiSettingsView = {
	settings: AiSettings;
	keys: Record<CloudProviderId, ApiKeyState>;
	keyStorage: KeyStorage;
	system: SystemInfo;
	recommendation: LocalRecommendation;
	/** Modelos instalados en Ollama, o null si Ollama no está en marcha. */
	ollamaModels: string[] | null;
	/** De dónde sale Ollama y si hay una descarga en curso. */
	local: LocalAiState;
};

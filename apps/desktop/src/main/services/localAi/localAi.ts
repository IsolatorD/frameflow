import { existsSync, mkdirSync, rmSync, statfsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PROVIDERS } from "@frameflow/core/ai/catalog";
import {
	aggregatePull,
	formatBytes,
	isRetryablePullError,
	type LocalAiState,
	type LocalEngine,
	type LocalJob,
	manifestPath,
	ollamaAsset,
	type Progress,
	type PullLine,
	releaseUrl,
	requiredBytes,
	SYSTEM_OLLAMA_URL,
} from "@frameflow/core/ai/localRuntime";
import { isUp, MANAGED_URL, OllamaServer, systemBinary } from "./ollamaServer";
import {
	cleanOldRuntimes,
	downloadFile,
	extractRuntime,
	installedBinary,
	officialChecksum,
	runtimeDir,
	sha256,
} from "./runtime";

// IA local "de un clic": decide qué Ollama usar (el del usuario o el de la app), y si no hay
// ninguno o falta el modelo, lo prepara todo con progreso, reintentos y cancelación.

const MAX_RETRIES = 30;
const RETRY_DELAY_MS = 5_000;
const EMIT_EVERY_MS = 250;

export type LocalAi = ReturnType<typeof createLocalAi>;

export function createLocalAi(opts: {
	dataDir: string;
	/** OLLAMA_URL: usar ese Ollama tal cual, sin gestionar nada (pruebas, servidores propios). */
	overrideUrl?: string;
	/** Ignorar el Ollama del sistema (para probar la descarga en un equipo que ya lo tiene). */
	ignoreSystem?: boolean;
	emit: (state: LocalAiState) => void;
}) {
	const runtime = ollamaAsset(process.platform, process.arch);
	const server = new OllamaServer(runtimeDir(opts.dataDir));
	let engine: LocalEngine = "missing";
	let url: string | null = null;
	let job: LocalJob | null = null;
	let abort: AbortController | null = null;
	let detecting: Promise<void> | null = null;
	let lastEmit = 0;

	const modelsDir = () => process.env.OLLAMA_MODELS ?? join(homedir(), ".ollama", "models");
	/** ¿El modelo ya está en la carpeta de Ollama? (aunque Ollama no esté en marcha) */
	const modelOnDisk = (model: string) => existsSync(join(modelsDir(), ...manifestPath(model)));

	const freeBytes = (): number | null => {
		const models = modelsDir();
		try {
			const stats = statfsSync(existsSync(models) ? models : homedir());
			return stats.bavail * stats.bsize;
		} catch {
			return null;
		}
	};

	const state = (): LocalAiState => ({
		engine,
		url,
		runtime,
		freeBytes: freeBytes(),
		modelsOnDisk: PROVIDERS.ollama.models.map((m) => m.id).filter(modelOnDisk),
		job,
	});

	const emit = (force = false) => {
		const now = Date.now();
		if (!force && now - lastEmit < EMIT_EVERY_MS) return;
		lastEmit = now;
		opts.emit(state());
	};

	const setJob = (patch: Partial<LocalJob>, force = true) => {
		if (!job) return;
		job = { ...job, ...patch };
		emit(force);
	};

	async function detectNow() {
		if (opts.overrideUrl) {
			engine = "system";
			url = opts.overrideUrl;
			return;
		}
		if (!opts.ignoreSystem && (await isUp(SYSTEM_OLLAMA_URL))) {
			engine = "system";
			url = SYSTEM_OLLAMA_URL;
			return;
		}
		const managed = installedBinary(opts.dataDir);
		const own = !opts.ignoreSystem ? systemBinary() : null;
		const binary = managed ?? own;
		if (!binary) {
			engine = "missing";
			url = null;
			return;
		}
		try {
			url = await server.start(binary);
			engine = managed ? "managed" : "system-binary";
		} catch (error) {
			engine = "missing";
			url = null;
			throw error;
		}
	}

	/** Decide qué Ollama usar y lo arranca si hace falta. Varias llamadas a la vez comparten trabajo. */
	async function detect(): Promise<LocalAiState> {
		if (!detecting) {
			detecting = detectNow().finally(() => {
				detecting = null;
			});
		}
		try {
			await detecting;
		} catch (error) {
			console.error("[local-ai]", error);
		}
		return state();
	}

	/** Mientras haya un Ollama gestionado en marcha, se reutiliza; si se cayó, se vuelve a arrancar. */
	async function ensure(): Promise<string | null> {
		if (url && (engine === "system" ? await isUp(url) : server.running)) return url;
		await detect();
		return url;
	}

	async function withRetries<T>(fn: () => Promise<T>, signal: AbortSignal): Promise<T> {
		for (let attempt = 0; ; attempt++) {
			try {
				return await fn();
			} catch (error) {
				if (signal.aborted) throw error;
				const message = error instanceof Error ? error.message : String(error);
				const network = error instanceof TypeError || isRetryablePullError(message);
				if (!network || attempt >= MAX_RETRIES) throw error;
				setJob({ retries: attempt + 1 });
				await sleep(RETRY_DELAY_MS, signal);
			}
		}
	}

	const speedMeter = () => {
		let last: { t: number; done: number } | null = null;
		let speed: number | null = null;
		return (progress: Progress) => {
			const now = Date.now();
			if (last && now - last.t >= 1000) {
				const current = ((progress.done - last.done) * 1000) / (now - last.t);
				speed = speed === null ? current : speed * 0.7 + current * 0.3;
				last = { t: now, done: progress.done };
			} else if (!last || progress.done < last.done) {
				last = { t: now, done: progress.done };
			}
			return speed;
		};
	};

	async function installRuntime(signal: AbortSignal) {
		if (!runtime) throw new Error("No hay una versión oficial de Ollama para este equipo.");
		const downloads = join(runtimeDir(opts.dataDir), "downloads");
		mkdirSync(downloads, { recursive: true });
		const archive = join(downloads, runtime.name);

		setJob({
			step: "runtime",
			progress: { done: 0, total: runtime.sizeMb * 1024 ** 2 },
			retries: 0,
		});
		const meter = speedMeter();
		await withRetries(
			() =>
				downloadFile(releaseUrl(runtime.name), archive, {
					signal,
					onProgress: (progress) => setJob({ progress, speed: meter(progress) }, false),
				}),
			signal,
		);

		setJob({ step: "verify", progress: null, speed: null, retries: 0 });
		const expected = await withRetries(() => officialChecksum(runtime, signal), signal);
		const actual = await sha256(archive);
		if (actual !== expected) {
			rmSync(archive, { force: true });
			throw new Error(
				"El archivo descargado no coincide con el publicado por Ollama (se ha borrado). Vuelve a intentarlo.",
			);
		}

		setJob({ step: "extract" });
		await extractRuntime(opts.dataDir, archive, runtime);
		cleanOldRuntimes(opts.dataDir);
	}

	async function pullModel(model: string, signal: AbortSignal) {
		setJob({ step: "model", progress: null, speed: null, retries: 0 });
		const meter = speedMeter();
		await withRetries(async () => {
			const base = await ensure();
			if (!base) throw new Error("Ollama no está en marcha.");
			const res = await fetch(`${base}/api/pull`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ model, stream: true }),
				signal,
			});
			if (!res.ok || !res.body) throw new Error(`Ollama respondió ${res.status} al descargar.`);
			let layers = new Map<string, { done: number; total: number }>();
			let buffer = "";
			const decoder = new TextDecoder();
			for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
				buffer += decoder.decode(chunk, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";
				for (const raw of lines) {
					if (!raw.trim()) continue;
					const line = JSON.parse(raw) as PullLine;
					if (line.error) throw new Error(line.error);
					const next = aggregatePull(layers, line);
					layers = next.layers;
					if (next.progress)
						setJob({ progress: next.progress, speed: meter(next.progress) }, false);
					if (line.status === "success") return;
				}
			}
			throw new Error("La descarga del modelo terminó sin confirmar (EOF).");
		}, signal);
	}

	async function runJob(model: string, modelGb: number | null, signal: AbortSignal) {
		await detect();
		const needsRuntime = engine === "missing";
		setJob({ step: "space", includesRuntime: needsRuntime });
		const needed = requiredBytes({
			runtime: needsRuntime ? runtime : null,
			modelGb: modelOnDisk(model) ? 0 : modelGb,
		});
		const free = freeBytes();
		if (free !== null && free < needed)
			throw new Error(
				`No hay espacio suficiente: hacen falta unos ${formatBytes(needed)} y quedan ${formatBytes(free)} libres.`,
			);
		if (needsRuntime) {
			await installRuntime(signal);
			setJob({ step: "start", progress: null, speed: null });
			await detect();
			if (!url) throw new Error("Ollama se descargó pero no se pudo arrancar.");
		}
		await pullModel(model, signal);
	}

	return {
		state,
		detect,
		ensure,
		/** URL actual de Ollama (para crear el proveedor); por defecto la del sistema. */
		url: () => url ?? SYSTEM_OLLAMA_URL,

		/** Prepara la IA local: descarga Ollama si falta y el modelo. Vuelve enseguida; avisa por eventos. */
		prepare(model: string, modelGb: number | null): LocalAiState {
			if (job?.status === "running") return state();
			abort = new AbortController();
			const signal = abort.signal;
			job = {
				model,
				step: "space",
				progress: null,
				speed: null,
				status: "running",
				retries: 0,
				includesRuntime: engine === "missing",
			};
			emit(true);
			runJob(model, modelGb, signal)
				.then(() => setJob({ status: "done", progress: null, speed: null }))
				.catch((error: unknown) => {
					if (signal.aborted) setJob({ status: "cancelled", speed: null });
					else
						setJob({
							status: "error",
							speed: null,
							error: error instanceof Error ? error.message : String(error),
						});
				});
			return state();
		},

		cancel() {
			abort?.abort();
		},

		/** Quita el aviso de un trabajo terminado, cancelado o fallido. */
		dismiss() {
			if (job && job.status !== "running") {
				job = null;
				emit(true);
			}
		},

		stop() {
			abort?.abort();
			server.stop();
		},
	};
}

function sleep(ms: number, signal: AbortSignal) {
	return new Promise<void>((resolve, reject) => {
		const timer = setTimeout(resolve, ms);
		signal.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				reject(signal.reason);
			},
			{ once: true },
		);
	});
}

export { MANAGED_URL };

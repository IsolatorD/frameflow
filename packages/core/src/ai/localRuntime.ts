// IA local sin instalar nada a mano: si el equipo no tiene Ollama, la app descarga la versión
// oficial (GitHub Releases), la verifica con SHA-256, la guarda en su carpeta de datos y la arranca
// mientras está abierta. Aquí va la parte pura (qué descargar, cómo medir el progreso); la
// descarga y el proceso viven en el proceso principal.

/** Versión fijada: se cambia a propósito (y se prueba), no se sigue "la última". */
export const OLLAMA_VERSION = "v0.40.16";

/** Puerto propio para el Ollama de la app: no choca con una instalación del sistema (11434). */
export const MANAGED_OLLAMA_PORT = 11435;
export const SYSTEM_OLLAMA_URL = "http://127.0.0.1:11434";

export type RuntimeAsset = {
	/** Nombre del archivo en la release. */
	name: string;
	/** Tamaño aproximado de la descarga, para avisar antes de empezar. */
	sizeMb: number;
	/** Cuánto ocupa ya extraído (aprox.), para comprobar el espacio libre. */
	installedMb: number;
	format: "tgz" | "tar.zst" | "zip";
};

/** Paquete oficial para el sistema y la arquitectura, o null si no hay. */
export function ollamaAsset(platform: string, arch: string): RuntimeAsset | null {
	if (platform === "darwin")
		return { name: "ollama-darwin.tgz", sizeMb: 186, installedMb: 600, format: "tgz" };
	if (platform === "win32" && arch === "x64")
		return { name: "ollama-windows-amd64.zip", sizeMb: 1618, installedMb: 4200, format: "zip" };
	if (platform === "win32" && arch === "arm64")
		return { name: "ollama-windows-arm64.zip", sizeMb: 387, installedMb: 1000, format: "zip" };
	if (platform === "linux" && arch === "x64")
		return {
			name: "ollama-linux-amd64.tar.zst",
			sizeMb: 1546,
			installedMb: 4500,
			format: "tar.zst",
		};
	if (platform === "linux" && arch === "arm64")
		return {
			name: "ollama-linux-arm64.tar.zst",
			sizeMb: 1601,
			installedMb: 4600,
			format: "tar.zst",
		};
	return null;
}

export const releaseUrl = (file: string, version = OLLAMA_VERSION) =>
	`https://github.com/ollama/ollama/releases/download/${version}/${file}`;

/** Lee `sha256sum.txt` ("<hash>  <archivo>" por línea) y devuelve el hash del archivo pedido. */
export function checksumFor(sumsFile: string, file: string): string | null {
	for (const line of sumsFile.split(/\r?\n/)) {
		const match = line.trim().match(/^([a-f0-9]{64})\s+\*?(?:\.\/)?(.+)$/i);
		if (match?.[2] === file) return (match[1] as string).toLowerCase();
	}
	return null;
}

/** Una línea del progreso de `POST /api/pull` de Ollama. */
export type PullLine = {
	status?: string;
	digest?: string;
	total?: number;
	completed?: number;
	error?: string;
};

export type Progress = { done: number; total: number | null };

/**
 * Progreso total de la descarga de un modelo: Ollama informa por capas (digest), así que se suma
 * lo hecho y el total de todas las capas vistas. Devuelve el nuevo mapa de capas.
 */
export function aggregatePull(
	layers: ReadonlyMap<string, { done: number; total: number }>,
	line: PullLine,
): { layers: Map<string, { done: number; total: number }>; progress: Progress | null } {
	const next = new Map(layers);
	if (line.digest && line.total) {
		next.set(line.digest, { done: line.completed ?? 0, total: line.total });
	}
	if (next.size === 0) return { layers: next, progress: null };
	let done = 0;
	let total = 0;
	for (const layer of next.values()) {
		done += Math.min(layer.done, layer.total);
		total += layer.total;
	}
	return { layers: next, progress: { done, total } };
}

/** Errores de red de Ollama que merecen reintentar (la descarga continúa donde iba). */
export const isRetryablePullError = (message: string) =>
	/max retries exceeded|EOF|timeout|connection reset|i\/o timeout|TLS handshake|network/i.test(
		message,
	);

/**
 * Ruta relativa del manifiesto de un modelo dentro de la carpeta de modelos de Ollama, para saber
 * si ya está descargado aunque Ollama no esté en marcha. "qwen3:8b" →
 * manifests/registry.ollama.ai/library/qwen3/8b; "hf.co/org/repo:tag" → manifests/hf.co/org/repo/tag.
 */
export function manifestPath(model: string): string[] {
	const [name, tag = "latest"] = splitTag(model);
	const parts = name.split("/");
	const full =
		parts.length >= 3
			? parts
			: parts.length === 2
				? ["registry.ollama.ai", ...parts]
				: ["registry.ollama.ai", "library", ...parts];
	return ["manifests", ...full, tag];
}

const splitTag = (model: string): [string, string | undefined] => {
	const slash = model.lastIndexOf("/");
	const colon = model.lastIndexOf(":");
	return colon > slash ? [model.slice(0, colon), model.slice(colon + 1)] : [model, undefined];
};

const GB = 1024 ** 3;
const MB = 1024 ** 2;

/** Bytes necesarios para preparar la IA local (con margen). */
export function requiredBytes(opts: { runtime: RuntimeAsset | null; modelGb: number | null }) {
	const runtime = opts.runtime ? (opts.runtime.sizeMb + opts.runtime.installedMb) * MB : 0;
	const model = opts.modelGb ? opts.modelGb * GB * 1.1 : 0;
	return Math.ceil(runtime + model + 0.5 * GB);
}

/** "1,2 GB", "350 MB" para la interfaz. */
export function formatBytes(bytes: number): string {
	if (bytes >= GB) return `${(bytes / GB).toLocaleString("es", { maximumFractionDigits: 1 })} GB`;
	return `${Math.max(1, Math.round(bytes / MB))} MB`;
}

/** De dónde sale el Ollama que usa la app. */
export type LocalEngine =
	/** Uno que ya estaba en marcha (instalado por el usuario) o indicado con OLLAMA_URL. */
	| "system"
	/** El del usuario, instalado pero cerrado: la app lo arranca. */
	| "system-binary"
	/** El que descargó la app. */
	| "managed"
	/** No hay ninguno: se ofrece descargarlo. */
	| "missing";

export type LocalJobStep = "space" | "runtime" | "verify" | "extract" | "start" | "model";

export type LocalJob = {
	model: string;
	step: LocalJobStep;
	/** Progreso del paso actual (descargas); null en pasos rápidos. */
	progress: Progress | null;
	/** Bytes por segundo de la descarga en curso (media reciente). */
	speed: number | null;
	status: "running" | "error" | "cancelled" | "done";
	error?: string;
	/** Reintentos tras cortes de red en el paso actual. */
	retries: number;
	/** El paso de Ollama forma parte de este trabajo (no estaba disponible). */
	includesRuntime: boolean;
};

/** Estado de la IA local que ve la interfaz. */
export type LocalAiState = {
	engine: LocalEngine;
	/** Dónde responde Ollama (null si no hay). */
	url: string | null;
	/** Paquete de Ollama para este equipo (null si no hay versión oficial). */
	runtime: RuntimeAsset | null;
	/** Espacio libre en el disco de los modelos (bytes), si se pudo medir. */
	freeBytes: number | null;
	/** Modelos del catálogo que ya están en la carpeta de Ollama (aunque Ollama no esté en marcha). */
	modelsOnDisk: string[];
	job: LocalJob | null;
};

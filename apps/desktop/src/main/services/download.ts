import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, renameSync, statSync } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Progress } from "@frameflow/core/ai/localRuntime";

// Descargas grandes (Ollama, modelos de voz): reanudables y con progreso.

export type DownloadOptions = {
	signal: AbortSignal;
	onProgress: (progress: Progress) => void;
};

/**
 * Descarga con reanudación: si quedó un archivo a medias, pide el resto (Range). Si el servidor
 * no lo admite, empieza de cero.
 */
export async function downloadFile(url: string, dest: string, opts: DownloadOptions) {
	const partial = `${dest}.part`;
	let start = existsSync(partial) ? statSync(partial).size : 0;
	const res = await fetch(url, {
		signal: opts.signal,
		headers: start > 0 ? { Range: `bytes=${start}-` } : {},
	});
	if (res.status === 416) {
		// Ya estaba completo.
		renameSync(partial, dest);
		return;
	}
	if (!res.ok || !res.body) throw new Error(`La descarga falló (${res.status} ${res.statusText}).`);
	if (start > 0 && res.status !== 206) start = 0; // el servidor ignoró el Range
	const length = Number(res.headers.get("content-length") ?? 0);
	const total = length > 0 ? start + length : null;
	let done = start;
	opts.onProgress({ done, total });
	const counter = new Transform({
		transform(chunk: Buffer, _enc, callback) {
			done += chunk.length;
			opts.onProgress({ done, total });
			callback(null, chunk);
		},
	});
	await pipeline(
		Readable.fromWeb(res.body as import("node:stream/web").ReadableStream),
		counter,
		createWriteStream(partial, { flags: start > 0 ? "a" : "w" }),
		{ signal: opts.signal },
	);
	renameSync(partial, dest);
}

export async function sha256(file: string): Promise<string> {
	const hash = createHash("sha256");
	await pipeline(createReadStream(file), hash);
	return hash.digest("hex");
}

/**
 * Descarga (si falta) y verifica un archivo de modelo: reintenta ante cortes de red y, si el hash no
 * coincide, lo borra. Un ".ok" junto al archivo recuerda que ya se verificó (no se vuelve a calcular).
 */
export async function ensureVerifiedFile(opts: {
	url: string;
	dest: string;
	sha256: string;
	signal?: AbortSignal;
	onProgress?: (progress: Progress) => void;
}): Promise<string> {
	const { mkdirSync, readFileSync, rmSync, writeFileSync } = await import("node:fs");
	const { dirname } = await import("node:path");
	const ok = `${opts.dest}.ok`;
	if (existsSync(opts.dest) && existsSync(ok) && readFileSync(ok, "utf8").trim() === opts.sha256)
		return opts.dest;
	mkdirSync(dirname(opts.dest), { recursive: true });
	const signal = opts.signal ?? new AbortController().signal;
	for (let attempt = 1; ; attempt++) {
		try {
			await downloadFile(opts.url, opts.dest, { signal, onProgress: (p) => opts.onProgress?.(p) });
			break;
		} catch (error) {
			if (signal.aborted || attempt >= 5 || !(error instanceof TypeError)) throw error;
			await new Promise((r) => setTimeout(r, 3000));
		}
	}
	if ((await sha256(opts.dest)) !== opts.sha256) {
		rmSync(opts.dest, { force: true });
		throw new Error("La descarga está dañada (se ha borrado). Vuelve a intentarlo.");
	}
	writeFileSync(ok, `${opts.sha256}\n`);
	return opts.dest;
}

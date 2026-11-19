import { renameSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import {
	hasSound,
	loudnormApplyFilter,
	loudnormMeasureFilter,
	parseLoudnorm,
} from "@frameflow/core/audio/loudness";
import { dimensionsFor, type Storyboard } from "@frameflow/core/storyboard";
import { storyboardDuration } from "@frameflow/core/storyboard/timeline";
import {
	type CancelSignal,
	ensureBrowser,
	makeCancelSignal,
	RenderInternals,
	renderMedia,
	renderStill,
	selectComposition,
} from "@remotion/renderer";

/**
 * De dónde sale la composición de Remotion: en desarrollo se empaqueta con webpack desde el código
 * (`entryPoint`); en la app instalada ya viene empaquetada (`serveUrl`, ver scripts/bundle-remotion).
 */
export type RemotionSource = { entryPoint: string } | { serveUrl: string };

let bundled: Promise<string> | null = null;

const getServeUrl = (source: RemotionSource) => {
	if ("serveUrl" in source) return Promise.resolve(source.serveUrl);
	bundled ??= import("@remotion/bundler")
		.then(({ bundle }) => bundle({ entryPoint: source.entryPoint }))
		.catch((error) => {
			bundled = null;
			throw error;
		});
	return bundled;
};

/**
 * Carpeta de los binarios de Remotion (compositor, ffmpeg) fuera del .asar: dentro de un archivo
 * .asar no se pueden ejecutar, así que electron-builder los deja en app.asar.unpacked.
 */
function binariesDirectory(): string | null {
	if (!import.meta.url.includes(".asar")) return null;
	const platform =
		process.platform === "win32"
			? `win32-${process.arch}-msvc`
			: process.platform === "linux"
				? `linux-${process.arch}-gnu`
				: `${process.platform}-${process.arch}`;
	const require = createRequire(createRequire(import.meta.url).resolve("@remotion/renderer"));
	const pkg = require.resolve(`@remotion/compositor-${platform}/package.json`);
	return dirname(pkg).replace(/app\.asar([\\/])/, "app.asar.unpacked$1");
}

export type RenderOutput = {
	/** Sonoridad final (LUFS) tras masterizar; null si el video no tiene sonido. */
	loudnessLufs: number | null;
	sizeBytes: number;
	durationSec: number;
	width: number;
	height: number;
};

export async function renderStoryboard(opts: {
	source: RemotionSource;
	storyboard: Storyboard;
	mediaBaseUrl: string;
	outputPath: string;
	onProgress: (progress: number | null, stage: string) => void;
	signal?: AbortSignal;
}): Promise<RenderOutput> {
	opts.onProgress(0, "Preparando el motor de video…");
	// La primera vez Remotion descarga su Chrome sin interfaz (~100 MB).
	await ensureBrowser({
		onBrowserDownload: () => ({
			version: null,
			onProgress: ({ percent, alreadyAvailable }) => {
				if (!alreadyAvailable)
					opts.onProgress(
						percent,
						`Descargando el motor de video (solo la primera vez): ${Math.round(percent * 100)} %`,
					);
			},
		}),
	});
	const serveUrl = await getServeUrl(opts.source);
	const inputProps = { storyboard: opts.storyboard, mediaBaseUrl: opts.mediaBaseUrl };
	const binaries = binariesDirectory();
	const composition = await selectComposition({
		serveUrl,
		id: "Storyboard",
		inputProps,
		binariesDirectory: binaries,
	});

	const cancelSignal = makeCancelSignal();
	opts.signal?.addEventListener("abort", () => cancelSignal.cancel());

	const raw = opts.outputPath.replace(/\.mp4$/, ".sin-masterizar.mp4");
	await renderMedia({
		serveUrl,
		composition,
		inputProps,
		codec: "h264",
		outputLocation: raw,
		cancelSignal: cancelSignal.cancelSignal,
		binariesDirectory: binaries,
		onProgress: ({ progress }) => opts.onProgress(progress * 0.97, "Renderizando…"),
	});
	opts.onProgress(null, "Ajustando el volumen para redes (−14 LUFS)…");
	let loudnessLufs: number | null;
	try {
		loudnessLufs = await masterLoudness(raw, opts.outputPath, binaries, cancelSignal.cancelSignal);
	} finally {
		rmSync(raw, { force: true });
	}

	return {
		loudnessLufs,
		sizeBytes: statSync(opts.outputPath).size,
		durationSec: storyboardDuration(opts.storyboard),
		...dimensionsFor(opts.storyboard.format),
	};
}

/** ffmpeg de Remotion (el mismo que codifica el video); devuelve su salida de error. */
async function ffmpeg(args: string[], binaries: string | null, cancelSignal?: CancelSignal) {
	const result = await RenderInternals.callFf({
		bin: "ffmpeg",
		args: ["-hide_banner", "-nostats", ...args],
		indent: false,
		logLevel: "error",
		binariesDirectory: binaries,
		cancelSignal,
	});
	return result.stderr;
}

/**
 * Masteriza el audio del MP4 a −14 LUFS (dos pasadas de loudnorm, ver core/audio/loudness) sin
 * volver a codificar la imagen. Devuelve la sonoridad final, o null si no hay sonido.
 */
async function masterLoudness(
	input: string,
	output: string,
	binaries: string | null,
	cancelSignal?: CancelSignal,
): Promise<number | null> {
	const measured = parseLoudnorm(
		await ffmpeg(
			["-i", input, "-vn", "-af", loudnormMeasureFilter, "-f", "null", "-"],
			binaries,
			cancelSignal,
		),
	);
	if (!hasSound(measured)) {
		renameSync(input, output);
		return null;
	}
	const report = await ffmpeg(
		[
			"-y",
			"-i",
			input,
			"-map",
			"0:v",
			"-map",
			"0:a",
			"-c:v",
			"copy",
			"-af",
			loudnormApplyFilter(measured),
			"-ar",
			"48000",
			"-c:a",
			"aac",
			"-b:a",
			"192k",
			"-movflags",
			"+faststart",
			output,
		],
		binaries,
		cancelSignal,
	);
	return Math.round(parseLoudnorm(report, "output").integrated * 10) / 10;
}

/** Un fotograma del video como imagen (portada para las redes). */
export async function renderFrame(opts: {
	source: RemotionSource;
	storyboard: Storyboard;
	mediaBaseUrl: string;
	/** Segundo del video que se toma. */
	atSeconds: number;
	outputPath: string;
}): Promise<void> {
	await ensureBrowser();
	const serveUrl = await getServeUrl(opts.source);
	const inputProps = { storyboard: opts.storyboard, mediaBaseUrl: opts.mediaBaseUrl };
	const binaries = binariesDirectory();
	const composition = await selectComposition({
		serveUrl,
		id: "Storyboard",
		inputProps,
		binariesDirectory: binaries,
	});
	const frame = Math.min(
		composition.durationInFrames - 1,
		Math.max(0, Math.round(opts.atSeconds * composition.fps)),
	);
	await renderStill({
		serveUrl,
		composition,
		inputProps,
		frame,
		output: opts.outputPath,
		imageFormat: "jpeg",
		jpegQuality: 90,
		binariesDirectory: binaries,
	});
}

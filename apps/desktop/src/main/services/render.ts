import { statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { dimensionsFor, type Storyboard } from "@frameflow/core/storyboard";
import { storyboardDuration } from "@frameflow/core/storyboard/timeline";
import {
	ensureBrowser,
	makeCancelSignal,
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

	await renderMedia({
		serveUrl,
		composition,
		inputProps,
		codec: "h264",
		outputLocation: opts.outputPath,
		cancelSignal: cancelSignal.cancelSignal,
		binariesDirectory: binaries,
		onProgress: ({ progress }) => opts.onProgress(progress, "Renderizando…"),
	});

	return {
		sizeBytes: statSync(opts.outputPath).size,
		durationSec: storyboardDuration(opts.storyboard),
		...dimensionsFor(opts.storyboard.format),
	};
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

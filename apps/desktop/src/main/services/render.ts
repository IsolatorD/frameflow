import { statSync } from "node:fs";
import { dimensionsFor, type Storyboard } from "@frameflow/core/storyboard";
import { storyboardDuration } from "@frameflow/core/storyboard/timeline";
import { bundle } from "@remotion/bundler";
import { makeCancelSignal, renderMedia, selectComposition } from "@remotion/renderer";

let bundled: Promise<string> | null = null;

/** Empaqueta la composición de Remotion una vez por sesión (la primera vez tarda unos segundos). */
const getBundle = (entryPoint: string) => {
	bundled ??= bundle({ entryPoint }).catch((error) => {
		bundled = null;
		throw error;
	});
	return bundled;
};

export type RenderOutput = {
	sizeBytes: number;
	durationSec: number;
	width: number;
	height: number;
};

export async function renderStoryboard(opts: {
	entryPoint: string;
	storyboard: Storyboard;
	mediaBaseUrl: string;
	outputPath: string;
	onProgress: (progress: number, stage: string) => void;
	signal?: AbortSignal;
}): Promise<RenderOutput> {
	opts.onProgress(0, "Preparando el motor de video…");
	const serveUrl = await getBundle(opts.entryPoint);
	const inputProps = { storyboard: opts.storyboard, mediaBaseUrl: opts.mediaBaseUrl };
	const composition = await selectComposition({ serveUrl, id: "Storyboard", inputProps });

	const cancelSignal = makeCancelSignal();
	opts.signal?.addEventListener("abort", () => cancelSignal.cancel());

	await renderMedia({
		serveUrl,
		composition,
		inputProps,
		codec: "h264",
		outputLocation: opts.outputPath,
		cancelSignal: cancelSignal.cancelSignal,
		onProgress: ({ progress }) => opts.onProgress(progress, "Renderizando…"),
	});

	return {
		sizeBytes: statSync(opts.outputPath).size,
		durationSec: storyboardDuration(opts.storyboard),
		...dimensionsFor(opts.storyboard.format),
	};
}

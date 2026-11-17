import { z } from "zod";
import { TARGET_SECONDS_RANGE } from "../script/script";
import { formatSchema, type Storyboard, type VideoFormat } from "../storyboard/schema";

/**
 * Estados de un video en el flujo de generación:
 * draft → (scripting) → draft (guion listo) → voicing → ready_to_render → rendering → ready
 * Un fallo devuelve el video al estado estable anterior y guarda el mensaje en `error`.
 */
export type VideoStatus =
	| "draft"
	| "scripting"
	| "voicing"
	| "ready_to_render"
	| "rendering"
	| "ready"
	| "published"
	| "archived";

export type VideoMode = "auto" | "stepwise";

export const createVideoInputSchema = z.object({
	projectId: z.string().uuid(),
	topic: z.string().trim().min(3, "Describe el tema con al menos 3 caracteres").max(300),
	language: z.string().min(2),
	format: formatSchema.default("9:16"),
	mode: z.enum(["auto", "stepwise"]),
	targetSeconds: z
		.number()
		.int()
		.min(TARGET_SECONDS_RANGE.min)
		.max(TARGET_SECONDS_RANGE.max)
		.default(60),
});
export type CreateVideoInput = z.input<typeof createVideoInputSchema>;

export type RenderInfo = {
	id: string;
	status: "queued" | "rendering" | "done" | "failed";
	path: string | null;
	sizeBytes: number | null;
	durationSec: number | null;
	error: string | null;
	finishedAt: string | null;
	/** Versión del storyboard que se renderizó (para saber si el MP4 está al día). */
	versionNumber: number;
};

export type VideoSummary = {
	id: string;
	projectId: string;
	title: string;
	topic: string;
	mode: VideoMode;
	status: VideoStatus;
	language: string;
	format: VideoFormat;
	durationSec: number;
	createdAt: string;
	updatedAt: string;
	error: string | null;
	hasVoice: boolean;
};

export type VideoDetail = VideoSummary & {
	variantId: string;
	versionNumber: number;
	storyboard: Storyboard;
	render: RenderInfo | null;
	/** Escenas cuya voz está al día (las demás se generarán en el próximo "Generar voz"). */
	voicedSceneIds: string[];
};

/** Progreso de una tarea larga (guion, voz, render), que el proceso principal emite a la interfaz. */
export type JobEvent = {
	videoId: string;
	step: "script" | "voice" | "render";
	state: "running" | "done" | "failed";
	/** 0–1, o null si no se puede medir. */
	progress: number | null;
	message: string;
};

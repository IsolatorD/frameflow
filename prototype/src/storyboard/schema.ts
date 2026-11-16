import { z } from "zod";

// El storyboard es el contrato central de Frameflow:
// la IA lo genera, el editor lo modifica y Remotion lo renderiza.

export const themeSchema = z.object({
	background: z.string(),
	text: z.string(),
	accent: z.string(),
	muted: z.string(),
});

// Campos comunes a todas las escenas.
// `narration` lo escribe la IA/usuario; `voice` lo rellena tts/generate.py.
const sceneBase = {
	durationInSeconds: z.number().positive(),
	narration: z.string().optional(),
	voice: z
		.object({
			src: z.string(),
			durationInSeconds: z.number().positive(),
			// Tiempos por palabra (segundos desde el inicio de la escena), vía Whisper.
			words: z
				.array(z.object({ text: z.string(), start: z.number(), end: z.number() }))
				.optional(),
		})
		.optional(),
};

const kineticTextScene = z.object({
	type: z.literal("kinetic-text"),
	...sceneBase,
	lines: z
		.array(
			z.object({
				text: z.string(),
				emphasis: z.boolean().optional(),
			}),
		)
		.min(1),
});

const statScene = z.object({
	type: z.literal("stat"),
	...sceneBase,
	value: z.number(),
	suffix: z.string().optional(),
	label: z.string(),
});

export const sceneSchema = z.discriminatedUnion("type", [
	kineticTextScene,
	statScene,
]);

export const storyboardSchema = z.object({
	title: z.string(),
	language: z.string().default("es"),
	voice: z
		.object({
			voiceId: z.string(),
			speed: z.number().positive().default(1),
		})
		.optional(),
	captions: z
		.object({
			enabled: z.boolean().default(true),
			maxWordsPerPage: z.number().int().positive().default(4),
		})
		.default({ enabled: true, maxWordsPerPage: 4 }),
	format: z.enum(["9:16", "16:9"]),
	fps: z.number().int().positive(),
	theme: themeSchema,
	scenes: z.array(sceneSchema).min(1),
});

export type Theme = z.infer<typeof themeSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type KineticTextScene = z.infer<typeof kineticTextScene>;
export type StatScene = z.infer<typeof statScene>;
export type Storyboard = z.infer<typeof storyboardSchema>;

export const dimensionsFor = (format: Storyboard["format"]) =>
	format === "9:16"
		? { width: 1080, height: 1920 }
		: { width: 1920, height: 1080 };

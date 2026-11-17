import { z } from "zod";

// Plantillas de escena: el contenido "inteligente" que genera la IA (texto cinético, cifras…).
// En v2 una escena es un tipo de clip más dentro de una pista visual.

export const themeSchema = z.object({
	background: z.string(),
	text: z.string(),
	accent: z.string(),
	muted: z.string(),
});

export const wordSchema = z.object({
	/** Palabra tal como se locuta (coincide con la narración). */
	text: z.string(),
	start: z.number(),
	end: z.number(),
	/** Cómo se muestra en el subtítulo si difiere (p. ej. "8 min" para "ocho minutos"). */
	display: z.string().optional(),
});

export const formatSchema = z.enum(["9:16", "16:9"]);

// Campos v1 comunes a todas las escenas.
const sceneBase = {
	durationInSeconds: z.number().positive(),
	narration: z.string().optional(),
	voice: z
		.object({
			src: z.string(),
			durationInSeconds: z.number().positive(),
			words: z.array(wordSchema).optional(),
		})
		.optional(),
};

/** Contenido de cada plantilla, sin tiempos (los tiempos los pone el clip). */
export const kineticTextContent = z.object({
	type: z.literal("kinetic-text"),
	lines: z.array(z.object({ text: z.string(), emphasis: z.boolean().optional() })).min(1),
});

export const statContent = z.object({
	type: z.literal("stat"),
	value: z.number(),
	suffix: z.string().optional(),
	label: z.string(),
});

export const sceneContentSchema = z.discriminatedUnion("type", [kineticTextContent, statContent]);

export const sceneSchema = z.discriminatedUnion("type", [
	kineticTextContent.extend(sceneBase),
	statContent.extend(sceneBase),
]);

export type Theme = z.infer<typeof themeSchema>;
export type Word = z.infer<typeof wordSchema>;
export type VideoFormat = z.infer<typeof formatSchema>;
export type SceneContent = z.infer<typeof sceneContentSchema>;
export type KineticTextContent = z.infer<typeof kineticTextContent>;
export type StatContent = z.infer<typeof statContent>;
/** Escena v1 (contenido + duración + voz). */
export type SceneV1 = z.infer<typeof sceneSchema>;

export const dimensionsFor = (format: VideoFormat) =>
	format === "9:16" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };

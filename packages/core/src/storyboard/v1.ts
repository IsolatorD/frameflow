import { z } from "zod";
import { formatSchema, sceneSchema, themeSchema } from "./scenes";

// Storyboard v1 (prototipo): escenas en fila, sin pistas.
// Se conserva solo para leer archivos antiguos; `migrateV1` lo convierte a v2.
export const storyboardV1Schema = z.object({
	title: z.string(),
	language: z.string().default("es"),
	voice: z.object({ voiceId: z.string(), speed: z.number().positive().default(1) }).optional(),
	captions: z
		.object({
			enabled: z.boolean().default(true),
			maxWordsPerPage: z.number().int().positive().default(4),
		})
		.default({ enabled: true, maxWordsPerPage: 4 }),
	format: formatSchema,
	fps: z.number().int().positive(),
	theme: themeSchema,
	scenes: z.array(sceneSchema).min(1),
});

export type StoryboardV1 = z.infer<typeof storyboardV1Schema>;

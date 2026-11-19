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

/** Límites de los tipos de escena con varios elementos (pensados para leerse en un móvil). */
export const SCENE_LIMITS = {
	items: { min: 2, max: 5 },
	text: 40,
	title: 40,
} as const;

const short = z.string().trim().min(1).max(SCENE_LIMITS.text);
const title = z.string().trim().max(SCENE_LIMITS.title).optional();
const many = <T extends z.ZodTypeAny>(item: T) =>
	z.array(item).min(SCENE_LIMITS.items.min).max(SCENE_LIMITS.items.max);

/** Pasos o lista numerada ("cómo funciona en 3 pasos"). */
export const stepsContent = z.object({ type: z.literal("steps"), title, items: many(short) });

/** Línea de tiempo: cuándo y qué pasó. */
export const timelineContent = z.object({
	type: z.literal("timeline"),
	title,
	events: many(z.object({ when: z.string().trim().min(1).max(16), label: short })),
});

/** Comparación A vs B, con un detalle opcional de cada lado. */
export const compareContent = z.object({
	type: z.literal("compare"),
	title,
	items: z
		.array(z.object({ label: short, detail: z.string().trim().max(SCENE_LIMITS.text).optional() }))
		.length(2),
});

/** Gráfico de barras con su unidad. */
export const chartContent = z.object({
	type: z.literal("chart"),
	title,
	suffix: z.string().max(8).optional(),
	bars: many(z.object({ label: short, value: z.number().nonnegative() })),
});

export const sceneContentSchema = z.discriminatedUnion("type", [
	kineticTextContent,
	statContent,
	stepsContent,
	timelineContent,
	compareContent,
	chartContent,
]);

/** Escenas v1: solo existían texto y cifra. */
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
export type StepsContent = z.infer<typeof stepsContent>;
export type TimelineContent = z.infer<typeof timelineContent>;
export type CompareContent = z.infer<typeof compareContent>;
export type ChartContent = z.infer<typeof chartContent>;
export type SceneKind = SceneContent["type"];

/** Nombre de cada tipo de escena para mostrar. */
export const SCENE_KIND_LABELS: Record<SceneKind, string> = {
	"kinetic-text": "Texto animado",
	stat: "Cifra destacada",
	steps: "Pasos",
	timeline: "Línea de tiempo",
	compare: "Comparación",
	chart: "Gráfico",
};

/** Lo que se ve en pantalla, en una línea (línea de tiempo, revisión con IA…). */
export function sceneSummary(content: SceneContent): string {
	switch (content.type) {
		case "kinetic-text":
			return content.lines.map((l) => l.text).join(" ");
		case "stat":
			return `${content.value}${content.suffix ?? ""} — ${content.label}`;
		case "steps":
			return content.items.map((t, i) => `${i + 1}. ${t}`).join(" · ");
		case "timeline":
			return content.events.map((e) => `${e.when}: ${e.label}`).join(" · ");
		case "compare":
			return content.items
				.map((c) => (c.detail ? `${c.label} (${c.detail})` : c.label))
				.join(" vs ");
		case "chart":
			return content.bars.map((b) => `${b.label} ${b.value}${content.suffix ?? ""}`).join(" · ");
	}
}
/** Escena v1 (contenido + duración + voz). */
export type SceneV1 = z.infer<typeof sceneSchema>;

export const dimensionsFor = (format: VideoFormat) =>
	format === "9:16" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };

import { z } from "zod";
import { formatSchema, sceneContentSchema, themeSchema, wordSchema } from "./scenes";

// Storyboard v2: el contrato central de Frameflow.
// La IA lo genera, el editor lo modifica y el renderer lo convierte en video.
//
// Modelo de línea de tiempo (como CapCut): pistas apiladas con clips que empiezan donde quieras.
// - Los tiempos están en SEGUNDOS (independientes de los fps); el renderer los ajusta al fotograma.
// - Las pistas visuales se dibujan en orden: la última queda encima.
// - Los subtítulos no son una pista: se calculan a partir de las palabras de los clips de voz.

export * from "./scenes";

export const STORYBOARD_VERSION = 2;

/** Tolerancia al comparar tiempos en segundos (medio fotograma a 60 fps). */
export const EPSILON = 1 / 120;

const id = z.string().min(1);
const seconds = z.number().min(0);

/** Campos de tiempo que comparten todos los clips. */
const timing = {
	id,
	/** Segundo de la línea de tiempo en que empieza el clip. */
	start: seconds,
	duration: z.number().positive(),
};

/** Posición y aspecto de un clip visual. x/y son el centro, en fracción del lienzo (0–1). */
export const transformSchema = z.object({
	x: z.number().default(0.5),
	y: z.number().default(0.5),
	scale: z.number().positive().default(1),
	rotation: z.number().default(0),
	opacity: z.number().min(0).max(1).default(1),
});

export const transitionSchema = z.object({
	type: z.enum(["none", "fade", "slide-up", "pop"]),
	duration: z.number().positive().default(0.4),
});

/**
 * Fotograma clave de una capa: su posición/aspecto en un instante (segundos desde el inicio del
 * clip). Entre dos fotogramas se interpola; antes del primero y después del último se mantiene.
 */
export const keyframeSchema = z.object({
	at: seconds,
	transform: transformSchema,
	/**
	 * Curva hasta este fotograma desde el anterior: suave (lenta al empezar y al terminar),
	 * acelerar (lenta al empezar), frenar (lenta al terminar) o lineal (ritmo constante).
	 */
	easing: z.enum(["ease", "ease-in", "ease-out", "linear"]).default("ease"),
});

const visual = {
	...timing,
	/** Nombre para mostrar en el editor (p. ej. el archivo original de una imagen). */
	label: z.string().optional(),
	transform: transformSchema.optional(),
	/** Animación de la capa; si hay fotogramas, mandan sobre `transform`. */
	keyframes: z.array(keyframeSchema).optional(),
	enter: transitionSchema.optional(),
	exit: transitionSchema.optional(),
};

/** Plantilla de escena a pantalla completa (lo que genera la IA). */
export const sceneClipSchema = z.object({
	type: z.literal("scene"),
	...visual,
	content: sceneContentSchema,
	/** Texto que se locuta durante la escena (lo usa el paso de voz). */
	narration: z.string().optional(),
	/** Colores propios de esta escena; si falta, se usa el estilo del video. */
	theme: themeSchema.partial().optional(),
	/** Segundos extra que la escena sigue en pantalla después de la voz (pausa dramática). */
	extraTime: seconds.default(0),
});

/** Texto libre encima del video (títulos, rótulos, llamadas a la acción). */
export const textClipSchema = z.object({
	type: z.literal("text"),
	...visual,
	text: z.string(),
	style: z
		.object({
			fontSize: z.number().positive().default(72),
			fontWeight: z.number().int().min(100).max(900).default(800),
			/** Nombre de color del tema ("text" | "accent"…) o #RRGGBB. */
			color: z.string().default("text"),
			background: z.string().optional(),
			align: z.enum(["left", "center", "right"]).default("center"),
		})
		.default({ fontSize: 72, fontWeight: 800, color: "text", align: "center" }),
});

const mediaSrc = {
	/** Ruta relativa a los recursos del proyecto, o URL. */
	src: z.string().min(1),
	/** Segundos del archivo original que se saltan al empezar (recorte por la izquierda). */
	trimStart: seconds.default(0),
};

export const imageClipSchema = z.object({
	type: z.literal("image"),
	...visual,
	src: z.string().min(1),
	fit: z.enum(["cover", "contain"]).default("contain"),
});

export const videoClipSchema = z.object({
	type: z.literal("video"),
	...visual,
	...mediaSrc,
	fit: z.enum(["cover", "contain"]).default("cover"),
	volume: z.number().min(0).max(2).default(1),
	playbackRate: z.number().positive().default(1),
	/** Duración del archivo original (límite para recortar). */
	sourceDuration: z.number().positive().optional(),
});

export const audioClipSchema = z.object({
	type: z.literal("audio"),
	...timing,
	...mediaSrc,
	/** voice = narración (genera subtítulos), music = fondo, sfx = efectos. */
	role: z.enum(["voice", "music", "sfx"]),
	volume: z.number().min(0).max(2).default(1),
	fadeIn: seconds.default(0),
	fadeOut: seconds.default(0),
	/** Palabras con tiempos relativos al inicio del ARCHIVO (salen de Whisper). */
	words: z.array(wordSchema).optional(),
	/** Clip al que va unido (p. ej. la escena que narra): el editor los mueve juntos. */
	linkedTo: id.optional(),
	/** Repetir el audio hasta cubrir el clip (música de fondo más corta que el video). */
	loop: z.boolean().default(false),
	/** Nombre para mostrar (p. ej. el archivo de música original). */
	label: z.string().optional(),
});

export const visualClipSchema = z.discriminatedUnion("type", [
	sceneClipSchema,
	textClipSchema,
	imageClipSchema,
	videoClipSchema,
]);

const trackBase = {
	id,
	name: z.string().default(""),
	hidden: z.boolean().default(false),
	locked: z.boolean().default(false),
};

export const visualTrackSchema = z.object({
	kind: z.literal("visual"),
	...trackBase,
	clips: z.array(visualClipSchema),
});

export const audioTrackSchema = z.object({
	kind: z.literal("audio"),
	...trackBase,
	muted: z.boolean().default(false),
	clips: z.array(audioClipSchema),
});

export const trackSchema = z.discriminatedUnion("kind", [visualTrackSchema, audioTrackSchema]);

/** Estilo del video: copia de la marca del canal en el momento de generarlo. */
export const videoStyleSchema = z.object({
	theme: themeSchema,
	fontFamily: z.string().default("Montserrat"),
	captions: z
		.object({
			enabled: z.boolean().default(true),
			maxWordsPerPage: z.number().int().positive().default(4),
		})
		.default({ enabled: true, maxWordsPerPage: 4 }),
});

export const storyboardSchema = z
	.object({
		version: z.literal(STORYBOARD_VERSION),
		title: z.string(),
		language: z.string().default("es"),
		format: formatSchema,
		fps: z.number().int().positive(),
		style: videoStyleSchema,
		tracks: z.array(trackSchema),
	})
	.superRefine((sb, ctx) => {
		// Ids únicos en todo el storyboard (el editor y los enlaces dependen de ello).
		const seen = new Set<string>();
		const clipIds = new Set<string>();
		for (const [t, track] of sb.tracks.entries()) {
			if (seen.has(track.id))
				ctx.addIssue({
					code: "custom",
					message: `Id repetido: ${track.id}`,
					path: ["tracks", t, "id"],
				});
			seen.add(track.id);
			const sorted = [...track.clips].sort((a, b) => a.start - b.start);
			for (const [c, clip] of track.clips.entries()) {
				if (seen.has(clip.id))
					ctx.addIssue({
						code: "custom",
						message: `Id repetido: ${clip.id}`,
						path: ["tracks", t, "clips", c, "id"],
					});
				seen.add(clip.id);
				clipIds.add(clip.id);
			}
			// Dentro de una pista los clips no se pisan (para superponer, se usa otra pista).
			for (let i = 1; i < sorted.length; i++) {
				const prev = sorted[i - 1];
				const cur = sorted[i];
				if (prev && cur && cur.start < prev.start + prev.duration - EPSILON) {
					ctx.addIssue({
						code: "custom",
						message: `En la pista "${track.name || track.id}" los clips ${prev.id} y ${cur.id} se solapan`,
						path: ["tracks", t, "clips"],
					});
				}
			}
		}
		for (const [t, track] of sb.tracks.entries()) {
			if (track.kind !== "audio") continue;
			for (const [c, clip] of track.clips.entries()) {
				if (clip.linkedTo && !clipIds.has(clip.linkedTo)) {
					ctx.addIssue({
						code: "custom",
						message: `El clip ${clip.id} está unido a ${clip.linkedTo}, que no existe`,
						path: ["tracks", t, "clips", c, "linkedTo"],
					});
				}
			}
		}
	});

export type Transform = z.infer<typeof transformSchema>;
export type Keyframe = z.infer<typeof keyframeSchema>;
export type Easing = Keyframe["easing"];
export type Transition = z.infer<typeof transitionSchema>;
export type SceneClip = z.infer<typeof sceneClipSchema>;
export type TextClip = z.infer<typeof textClipSchema>;
export type ImageClip = z.infer<typeof imageClipSchema>;
export type VideoClip = z.infer<typeof videoClipSchema>;
export type AudioClip = z.infer<typeof audioClipSchema>;
export type VisualClip = z.infer<typeof visualClipSchema>;
export type Clip = VisualClip | AudioClip;
export type VisualTrack = z.infer<typeof visualTrackSchema>;
export type AudioTrack = z.infer<typeof audioTrackSchema>;
export type Track = z.infer<typeof trackSchema>;
export type VideoStyle = z.infer<typeof videoStyleSchema>;
export type Storyboard = z.infer<typeof storyboardSchema>;
/** Lo que se escribe a mano o devuelve la IA (con campos opcionales/por defecto). */
export type StoryboardInput = z.input<typeof storyboardSchema>;

import { z } from "zod";
import type { VideoFormat } from "../storyboard/scenes";
import {
	type SceneClip,
	type Storyboard,
	sceneContentSchema,
	type VideoStyle,
} from "../storyboard/schema";
import { buildFromScenes, type ScriptScene } from "../storyboard/timeline";

// El guion es la parte del video que escribe la IA o el usuario en el modo paso a paso:
// escenas con su narración y su contenido visual. Todo lo demás (colores, voz, formato) sale de la marca.

export const WORDS_PER_SECOND = 2.6; // ritmo aproximado de la voz; la duración real la da el TTS
export const VOICE_TAIL_SECONDS = 0.5; // respiro tras cada narración antes de cambiar de escena
export const MIN_SCENE_SECONDS = 2.5;
export const TARGET_SECONDS_RANGE = { min: 20, max: 180, step: 10 } as const;

export const scriptSceneSchema = z.object({
	narration: z.string().trim().min(1, "Cada escena necesita narración"),
	content: sceneContentSchema,
});

export const scriptSchema = z.object({
	title: z.string().trim().min(1, "El video necesita un título").max(80),
	scenes: z.array(scriptSceneSchema).min(1, "El guion necesita al menos una escena"),
});

export type ScriptSceneInput = z.infer<typeof scriptSceneSchema>;
export type Script = z.infer<typeof scriptSchema>;

/** Segundos que tardará la voz en leer un texto (estimación previa al TTS). */
export const estimateSeconds = (text: string): number => {
	const words = text.trim().split(/\s+/).filter(Boolean).length;
	return Math.max(MIN_SCENE_SECONDS, Math.round((words / WORDS_PER_SECOND) * 10) / 10);
};

/** Cuántas escenas pedir para una duración objetivo (una cada 3,5–7 s). */
export const sceneRange = (seconds: number): [number, number] => [
	Math.max(3, Math.floor(seconds / 7)),
	Math.max(4, Math.ceil(seconds / 3.5)),
];

export type SceneVoice = {
	src: string;
	duration: number;
	words?: { text: string; start: number; end: number }[];
};

/**
 * Guion (+ voces, si ya existen) → storyboard v2 con el estilo de la marca.
 * Sin voz, cada escena dura lo estimado; con voz, lo que dura la voz más un respiro.
 * Si la marca tiene llamada a la acción, se añade una pista con ella al final.
 */
export const assembleStoryboard = (input: {
	script: Script;
	language: string;
	format: VideoFormat;
	style: VideoStyle;
	ctaText?: string;
	/** Voz por índice de escena (undefined = aún sin voz). */
	voices?: readonly (SceneVoice | undefined)[];
	fps?: number;
}): Storyboard => {
	const scenes: ScriptScene[] = input.script.scenes.map((scene, i) => {
		const voice = input.voices?.[i];
		return {
			content: scene.content,
			narration: scene.narration,
			duration: voice ? voice.duration + VOICE_TAIL_SECONDS : estimateSeconds(scene.narration),
			voice,
		};
	});
	const sb = buildFromScenes({
		title: input.script.title,
		language: input.language,
		format: input.format,
		fps: input.fps ?? 30,
		style: input.style,
		scenes,
		sceneExit: { type: "fade", duration: 0.4 },
	});

	const cta = input.ctaText?.trim();
	const total = scenes.reduce((sum, s) => sum + s.duration, 0);
	if (!cta || total < 3) return sb;
	return {
		...sb,
		tracks: [
			...sb.tracks,
			{
				kind: "visual",
				id: "track-cta",
				name: "Llamada a la acción",
				hidden: false,
				locked: false,
				clips: [
					{
						type: "text",
						id: "cta",
						start: Math.max(0, total - 2.5),
						duration: Math.min(2.5, total),
						text: cta,
						transform: { x: 0.5, y: 0.82, scale: 1, rotation: 0, opacity: 1 },
						style: {
							fontSize: 56,
							fontWeight: 800,
							color: "background",
							background: "accent",
							align: "center",
						},
						enter: { type: "pop", duration: 0.4 },
					},
				],
			},
		],
	};
};

/** Lee el guion de vuelta desde un storyboard (las escenas de la pista principal, en orden). */
export const scriptFromStoryboard = (sb: Storyboard): Script => {
	const sceneTrack = sb.tracks.find(
		(t) => t.kind === "visual" && t.clips.some((c) => c.type === "scene"),
	);
	const scenes = (sceneTrack?.clips ?? [])
		.filter((c): c is SceneClip => c.type === "scene")
		.sort((a, b) => a.start - b.start)
		.map((c) => ({ narration: c.narration ?? "", content: c.content }));
	return { title: sb.title, scenes };
};

/** "Por qué el cielo…" → "por qué el cielo…" (para insertarlo en mitad de una frase). */
const midSentence = (text: string) =>
	/^\p{Lu}\p{Ll}/u.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;

/** Guion inicial del modo paso a paso: una estructura gancho → dato → cierre para rellenar. */
export const starterScript = (topic: string): Script => {
	const clean = topic.trim();
	return {
		title: clean.slice(0, 80) || "Nuevo video",
		scenes: [
			{
				narration: `¿Sabías esto sobre ${midSentence(clean) || "este tema"}?`,
				content: {
					type: "kinetic-text",
					lines: [{ text: "¿Sabías que…" }, { text: clean.slice(0, 30) || "…", emphasis: true }],
				},
			},
			{
				narration: "Escribe aquí el dato principal, con los números en letras.",
				content: { type: "stat", value: 100, suffix: "%", label: "Explica la cifra" },
			},
			{
				narration: "Cierra con una frase memorable.",
				content: { type: "kinetic-text", lines: [{ text: "Frase final", emphasis: true }] },
			},
		],
	};
};

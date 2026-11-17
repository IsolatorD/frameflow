import type { SceneContent, VideoFormat, Word } from "./scenes";
import {
	type AudioClip,
	type Clip,
	EPSILON,
	type SceneClip,
	STORYBOARD_VERSION,
	type Storyboard,
	type StoryboardInput,
	storyboardSchema,
	type Track,
	type VideoStyle,
} from "./schema";
import { type StoryboardV1, storyboardV1Schema } from "./v1";

// Operaciones puras sobre la línea de tiempo. Las usan el renderer, el generador y el editor;
// nunca mutan: devuelven un storyboard nuevo (facilita deshacer/rehacer).

export const clipEnd = (clip: Pick<Clip, "start" | "duration">): number =>
	clip.start + clip.duration;

/** Duración total: hasta donde termina el último clip de cualquier pista. */
export const storyboardDuration = (sb: Storyboard): number =>
	Math.max(0, ...sb.tracks.flatMap((t) => t.clips.map(clipEnd)));

export const toFrames = (seconds: number, fps: number): number => Math.round(seconds * fps);

export const findClip = (sb: Storyboard, clipId: string): { track: Track; clip: Clip } | null => {
	for (const track of sb.tracks) {
		const clip = track.clips.find((c) => c.id === clipId);
		if (clip) return { track, clip };
	}
	return null;
};

/**
 * Palabras de la narración en tiempo de línea de tiempo (para los subtítulos).
 * Solo cuentan los clips de voz de pistas audibles, y solo la parte del archivo que suena.
 */
export const captionWords = (sb: Storyboard): Word[] =>
	sb.tracks
		.flatMap((track) =>
			track.kind === "audio" && !track.muted && !track.hidden ? track.clips : [],
		)
		.filter((clip): clip is AudioClip & { words: Word[] } => clip.role === "voice" && !!clip.words)
		.flatMap((clip) => {
			const offset = clip.start - clip.trimStart;
			return clip.words
				.filter(
					(w) => w.start >= clip.trimStart - EPSILON && w.start < clip.trimStart + clip.duration,
				)
				.map((w) => ({
					text: w.display?.trim() || w.text,
					start: w.start + offset,
					end: Math.min(w.end + offset, clipEnd(clip)),
				}));
		})
		.sort((a, b) => a.start - b.start);

/**
 * Corta un clip en dos en el segundo `at` de la línea de tiempo (la "tijera" del editor).
 * La parte izquierda conserva el id y la transición de entrada; la derecha recibe `newId`
 * y la de salida. En audio/video la derecha avanza su recorte para seguir sonando igual.
 */
export const splitClip = (
	sb: Storyboard,
	clipId: string,
	at: number,
	newId: string,
): Storyboard => {
	const found = findClip(sb, clipId);
	if (!found) throw new Error(`No existe el clip ${clipId}`);
	const { clip } = found;
	if (at <= clip.start + EPSILON || at >= clipEnd(clip) - EPSILON) {
		throw new Error("El corte tiene que caer dentro del clip");
	}
	if (findClip(sb, newId)) throw new Error(`El id ${newId} ya existe`);

	const leftDuration = at - clip.start;
	const left = { ...clip, duration: leftDuration };
	const right = { ...clip, id: newId, start: at, duration: clipEnd(clip) - at };
	if ("trimStart" in right) {
		const rate = right.type === "video" ? right.playbackRate : 1;
		right.trimStart += leftDuration * rate;
	}
	if (left.type !== "audio" && right.type !== "audio") {
		left.exit = undefined;
		right.enter = undefined;
	} else if (left.type === "audio" && right.type === "audio") {
		left.fadeOut = 0;
		right.fadeIn = 0;
	}

	return {
		...sb,
		tracks: sb.tracks.map((track) =>
			track.id !== found.track.id
				? track
				: ({
						...track,
						clips: track.clips.flatMap((c) => (c.id === clipId ? [left, right] : [c])),
					} as Track),
		),
	};
};

/** Una escena tal como la escribe la IA o el modo paso a paso, antes de montar la línea de tiempo. */
export type ScriptScene = {
	content: SceneContent;
	duration: number;
	narration?: string;
	voice?: { src: string; duration: number; words?: Word[] };
};

/**
 * Monta un storyboard v2 a partir de escenas en fila: una pista "Escenas" y,
 * si hay voces, una pista "Voz" con cada narración unida a su escena.
 * Si la voz dura más que la escena, la escena se alarga para no cortarla.
 */
export const buildFromScenes = (input: {
	title: string;
	language: string;
	format: VideoFormat;
	fps: number;
	style: VideoStyle;
	scenes: readonly ScriptScene[];
	sceneExit?: SceneClip["exit"];
}): Storyboard => {
	let cursor = 0;
	const sceneClips: SceneClip[] = [];
	const voiceClips: AudioClip[] = [];
	input.scenes.forEach((scene, i) => {
		const sceneId = `scene-${i + 1}`;
		const duration = Math.max(scene.duration, scene.voice?.duration ?? 0);
		sceneClips.push({
			type: "scene",
			id: sceneId,
			start: cursor,
			duration,
			content: scene.content,
			narration: scene.narration,
			exit: input.sceneExit,
			extraTime: 0,
		});
		if (scene.voice) {
			voiceClips.push({
				type: "audio",
				id: `voice-${i + 1}`,
				start: cursor,
				duration: scene.voice.duration,
				src: scene.voice.src,
				trimStart: 0,
				role: "voice",
				volume: 1,
				fadeIn: 0,
				fadeOut: 0,
				words: scene.voice.words,
				linkedTo: sceneId,
				loop: false,
			});
		}
		cursor += duration;
	});

	const tracks: StoryboardInput["tracks"] = [
		{ kind: "visual", id: "track-scenes", name: "Escenas", clips: sceneClips },
	];
	if (voiceClips.length > 0) {
		tracks.push({ kind: "audio", id: "track-voice", name: "Voz", clips: voiceClips });
	}

	return storyboardSchema.parse({
		version: STORYBOARD_VERSION,
		title: input.title,
		language: input.language,
		format: input.format,
		fps: input.fps,
		style: input.style,
		tracks,
	} satisfies StoryboardInput);
};

/** v1 (escenas en fila) → v2. Conserva el aspecto: fundido de salida de 0,4 s en cada escena. */
export const migrateV1 = (v1: StoryboardV1): Storyboard =>
	buildFromScenes({
		title: v1.title,
		language: v1.language,
		format: v1.format,
		fps: v1.fps,
		style: { theme: v1.theme, fontFamily: "Montserrat", captions: v1.captions },
		sceneExit: { type: "fade", duration: 0.4 },
		scenes: v1.scenes.map(({ durationInSeconds, narration, voice, ...content }) => ({
			content,
			duration: durationInSeconds,
			narration,
			voice: voice && {
				src: voice.src,
				duration: voice.durationInSeconds,
				words: voice.words,
			},
		})),
	});

/** Lee un storyboard de cualquier versión conocida y lo devuelve en la actual (v2). */
export const parseStoryboard = (input: unknown): Storyboard => {
	if (typeof input === "object" && input !== null) {
		if ("version" in input) return storyboardSchema.parse(input);
		if ("scenes" in input) return migrateV1(storyboardV1Schema.parse(input));
	}
	throw new Error("No es un storyboard de Frameflow (falta `version` o `scenes`)");
};

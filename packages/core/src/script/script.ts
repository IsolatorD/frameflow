import { z } from "zod";
import { SFX, SFX_VOLUME_RANGE, sfxEvents } from "../audio/sfx";
import { resolveVisualStyle, type VisualStyle, visualStyleSchema } from "../look/looks";
import type { VideoFormat } from "../storyboard/scenes";
import {
	type AudioClip,
	type Clip,
	type SceneClip,
	STORYBOARD_VERSION,
	type Storyboard,
	type StoryboardInput,
	sceneContentSchema,
	storyboardSchema,
	type TextClip,
	type Track,
	transitionSchema,
	type VideoStyle,
} from "../storyboard/schema";

// El guion es la parte del video que escribe la IA o el usuario en el modo paso a paso:
// escenas con su narración y su contenido visual. Todo lo demás (colores, voz, formato) sale de la marca.

export const WORDS_PER_SECOND = 2.6; // ritmo aproximado de la voz; la duración real la da el TTS
export const VOICE_TAIL_SECONDS = 0.5; // respiro tras cada narración antes de cambiar de escena
export const MIN_SCENE_SECONDS = 2.5;
export const TARGET_SECONDS_RANGE = { min: 20, max: 180, step: 10 } as const;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Usa un color #RRGGBB");
export const TRANSITION_TYPES = transitionSchema.shape.type.options;
export type TransitionType = (typeof TRANSITION_TYPES)[number];
export const EXTRA_TIME_RANGE = { min: 0, max: 5, step: 0.5 } as const;
export const TRANSITION_SECONDS = 0.4;

/** Ajustes visuales de una escena que el editor permite cambiar (sobreviven al regenerar). */
export const sceneSettingsSchema = z.object({
	accent: hexColor.optional(),
	background: hexColor.optional(),
	/** Sin definir = sin transición de entrada. */
	enter: z.enum(TRANSITION_TYPES).optional(),
	/** Sin definir = fundido (el comportamiento por defecto). */
	exit: z.enum(TRANSITION_TYPES).optional(),
	extraTime: z.number().min(EXTRA_TIME_RANGE.min).max(EXTRA_TIME_RANGE.max).optional(),
});
export type SceneSettings = z.infer<typeof sceneSettingsSchema>;

export const scriptSceneSchema = z.object({
	/** Identidad estable de la escena (conserva su voz y sus ajustes al reordenar o editar). */
	id: z.string().min(1).optional(),
	narration: z.string().trim().min(1, "Cada escena necesita narración"),
	content: sceneContentSchema,
	settings: sceneSettingsSchema.optional(),
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

export type MusicSettings = {
	/** Ruta relativa a la carpeta del proyecto. */
	src: string;
	label: string;
	volume: number;
	fadeIn: number;
	fadeOut: number;
};

/** Efectos de sonido sutiles (ver core/audio/sfx): activados con un volumen común. */
export type SfxSettings = { volume: number };

export const MUSIC_VOLUME_RANGE = { min: 0, max: 1, step: 0.05 } as const;
/** Volumen inicial de la música: por debajo de la voz. */
export const DEFAULT_MUSIC_VOLUME = 0.15;

/** Altura (0–1) del centro de la llamada a la acción: por encima de los subtítulos. */
export const CTA_Y = 0.7;

const TRACK_IDS = {
	scenes: "track-scenes",
	voice: "track-voice",
	music: "track-music",
	cta: "track-cta",
	sfx: "track-sfx",
} as const;

const sameWords = (a: string, b: string) =>
	a.trim().split(/\s+/).join(" ") === b.trim().split(/\s+/).join(" ");

const sceneClips = (sb: Storyboard): SceneClip[] =>
	sb.tracks
		.flatMap((t): Clip[] => t.clips)
		.filter((c): c is SceneClip => c.type === "scene")
		.sort((a, b) => a.start - b.start);

const voiceClips = (sb: Storyboard): AudioClip[] =>
	sb.tracks.flatMap((t) =>
		t.kind === "audio" ? t.clips.filter((c) => c.role === "voice" && c.linkedTo) : [],
	);

/** Voz de una escena, solo si se generó con su narración actual. */
const currentVoice = (
	sb: Storyboard | undefined,
	sceneId: string,
	narration: string,
): SceneVoice | undefined => {
	const clip = sb && voiceClips(sb).find((c) => c.linkedTo === sceneId);
	if (!clip?.words || !sameWords(clip.words.map((w) => w.text).join(" "), narration))
		return undefined;
	return { src: clip.src, duration: clip.duration, words: clip.words };
};

const sfxTrackOf = (sb: Storyboard | undefined) =>
	sb?.tracks.find((t) => t.kind === "audio" && t.id === TRACK_IDS.sfx);

const sfxOf = (sb: Storyboard | undefined): SfxSettings | null => {
	const track = sfxTrackOf(sb);
	if (!track) return null;
	const clip = track.clips[0] as AudioClip | undefined;
	return { volume: clip?.volume ?? 0.4 };
};

const musicOf = (sb: Storyboard | undefined): MusicSettings | null => {
	const clip = sb?.tracks
		.flatMap((t) => (t.kind === "audio" ? t.clips : []))
		.find((c) => c.role === "music");
	return clip
		? {
				src: clip.src,
				label: clip.label ?? clip.src.split("/").pop() ?? clip.src,
				volume: clip.volume,
				fadeIn: clip.fadeIn,
				fadeOut: clip.fadeOut,
			}
		: null;
};

const ctaClipOf = (sb: Storyboard | undefined): TextClip | undefined => {
	const clip = sb?.tracks.find((t) => t.id === TRACK_IDS.cta)?.clips[0];
	return clip?.type === "text" ? clip : undefined;
};
const ctaOf = (sb: Storyboard | undefined): string => ctaClipOf(sb)?.text ?? "";

export const CTA_DEFAULT_SECONDS = 2.5;
export const CTA_SECONDS_RANGE = { min: 1, max: 10 } as const;

/** Duración de la llamada a la acción y hueco hasta el final del video (se conservan al editar). */
const ctaTimingOf = (sb: Storyboard | undefined) => {
	const clip = ctaClipOf(sb);
	if (!sb || !clip) return { duration: CTA_DEFAULT_SECONDS, endGap: 0 };
	const total = sb.tracks
		.flatMap((t): Clip[] => t.clips)
		.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
	return { duration: clip.duration, endGap: Math.max(0, total - (clip.start + clip.duration)) };
};

/** Ids de las escenas que tienen la voz al día. */
/** Escenas cuya voz al día es una grabación del usuario (archivos "rec-…"). */
export const recordedSceneIds = (sb: Storyboard): Set<string> =>
	new Set(
		sceneClips(sb)
			.filter((c) => /(^|\/)rec-[^/]*$/.test(currentVoice(sb, c.id, c.narration ?? "")?.src ?? ""))
			.map((c) => c.id),
	);

export const voicedSceneIds = (sb: Storyboard): Set<string> =>
	new Set(
		sceneClips(sb)
			.filter((c) => currentVoice(sb, c.id, c.narration ?? ""))
			.map((c) => c.id),
	);

/** ¿Todas las escenas tienen su voz al día? (requisito para renderizar). */
export const isFullyVoiced = (sb: Storyboard): boolean => {
	const scenes = sceneClips(sb);
	const voiced = voicedSceneIds(sb);
	return scenes.length > 0 && scenes.every((c) => voiced.has(c.id));
};

const uniqueSceneIds = (script: Script): string[] => {
	const used = new Set(script.scenes.flatMap((s) => (s.id ? [s.id] : [])));
	let n = 1;
	const seen = new Set<string>();
	return script.scenes.map((scene) => {
		if (scene.id && !seen.has(scene.id)) {
			seen.add(scene.id);
			return scene.id;
		}
		while (used.has(`scene-${n}`)) n++;
		const id = `scene-${n}`;
		used.add(id);
		seen.add(id);
		return id;
	});
};

/**
 * Guion → storyboard v2. Si hay un storyboard anterior, conserva lo editado:
 * la voz de cada escena cuya narración no cambió, la música, la llamada a la acción y el estilo.
 * Duración de cada escena: voz + respiro (o estimación sin voz) + su tiempo extra.
 */
export const assembleStoryboard = (input: {
	script: Script;
	language: string;
	format: VideoFormat;
	style: VideoStyle;
	/** Undefined = conservar la del storyboard anterior. */
	ctaText?: string;
	/** Voces nuevas por id de escena (las demás se toman del storyboard anterior si siguen al día). */
	voices?: Readonly<Record<string, SceneVoice>>;
	/** Undefined = conservar la del storyboard anterior; null = quitarla. */
	music?: MusicSettings | null;
	/** Efectos de sonido. Undefined = como en el storyboard anterior; null = sin efectos. */
	sfx?: SfxSettings | null;
	previous?: Storyboard;
	fps?: number;
}): Storyboard => {
	const ids = uniqueSceneIds(input.script);
	const scenes: SceneClip[] = [];
	const voices: AudioClip[] = [];
	let cursor = 0;
	input.script.scenes.forEach((scene, i) => {
		const id = ids[i] as string;
		const settings = scene.settings ?? {};
		const voice = input.voices?.[id] ?? currentVoice(input.previous, id, scene.narration);
		const extraTime = settings.extraTime ?? 0;
		const duration =
			(voice ? voice.duration + VOICE_TAIL_SECONDS : estimateSeconds(scene.narration)) + extraTime;
		const theme = {
			...(settings.accent ? { accent: settings.accent } : {}),
			...(settings.background ? { background: settings.background } : {}),
		};
		scenes.push({
			type: "scene",
			id,
			start: cursor,
			duration,
			content: scene.content,
			narration: scene.narration,
			extraTime,
			...(Object.keys(theme).length ? { theme } : {}),
			enter:
				settings.enter && settings.enter !== "none"
					? { type: settings.enter, duration: TRANSITION_SECONDS }
					: undefined,
			exit:
				settings.exit === "none"
					? undefined
					: { type: settings.exit ?? "fade", duration: TRANSITION_SECONDS },
		});
		if (voice) {
			voices.push({
				type: "audio",
				id: `voice-${id}`,
				start: cursor,
				duration: voice.duration,
				src: voice.src,
				trimStart: 0,
				role: "voice",
				volume: 1,
				fadeIn: 0,
				fadeOut: 0,
				words: voice.words,
				linkedTo: id,
				loop: false,
			});
		}
		cursor += duration;
	});
	const total = cursor;

	const tracks: Track[] = [
		{
			kind: "visual",
			id: TRACK_IDS.scenes,
			name: "Escenas",
			hidden: false,
			locked: false,
			clips: scenes,
		},
	];
	if (voices.length > 0) {
		tracks.push({
			kind: "audio",
			id: TRACK_IDS.voice,
			name: "Voz",
			hidden: false,
			locked: false,
			muted: false,
			clips: voices,
		});
	}

	const music = input.music === undefined ? musicOf(input.previous) : input.music;
	if (music) {
		tracks.push({
			kind: "audio",
			id: TRACK_IDS.music,
			name: "Música",
			hidden: false,
			locked: false,
			muted: false,
			clips: [
				{
					type: "audio",
					id: "music",
					start: 0,
					duration: total,
					src: music.src,
					label: music.label,
					trimStart: 0,
					role: "music",
					volume: music.volume,
					fadeIn: music.fadeIn,
					fadeOut: music.fadeOut,
					loop: true,
				},
			],
		});
	}

	const cta = (input.ctaText ?? ctaOf(input.previous)).trim();
	if (cta && total >= 3) {
		const timing = ctaTimingOf(input.previous);
		const duration = Math.min(timing.duration, total);
		const clip: TextClip = {
			type: "text",
			id: "cta",
			start: Math.max(0, total - Math.min(timing.endGap, total - duration) - duration),
			duration,
			text: cta,
			// Por encima de la franja de subtítulos (abajo, ~12 % de la altura) para no taparlos.
			transform: { x: 0.5, y: CTA_Y, scale: 1, rotation: 0, opacity: 1 },
			style: {
				fontSize: 56,
				fontWeight: 800,
				color: "background",
				background: "accent",
				align: "center",
			},
			enter: { type: "pop", duration: TRANSITION_SECONDS },
		};
		tracks.push({
			kind: "visual",
			id: TRACK_IDS.cta,
			name: "Llamada a la acción",
			hidden: false,
			locked: false,
			clips: [clip],
		});
	}

	// Efectos: se recolocan siempre según las escenas (si cambian los tiempos, los efectos los siguen).
	const sfx = input.sfx === undefined ? sfxOf(input.previous) : input.sfx;
	if (sfx) {
		const ctaClip = tracks.find((t) => t.id === TRACK_IDS.cta)?.clips[0];
		const clips: AudioClip[] = sfxEvents(scenes, ctaClip)
			.map((event, i) => {
				const def = SFX[event.kind];
				const start = Math.max(0, event.at - def.peak);
				return {
					type: "audio" as const,
					id: `sfx-${i + 1}`,
					start,
					duration: Math.min(def.duration, total - start),
					src: def.file,
					label: def.label,
					trimStart: 0,
					role: "sfx" as const,
					volume: sfx.volume,
					fadeIn: 0,
					fadeOut: 0,
					loop: false,
				};
			})
			.filter((c) => c.duration > 0.05);
		// En una pista no puede haber clips solapados: si un efecto pisa al siguiente, se recorta
		// con un fundido muy corto (su cola ya es casi silencio).
		clips.forEach((c, i) => {
			const next = clips[i + 1];
			if (next && c.start + c.duration > next.start) {
				c.duration = Math.max(0.02, next.start - c.start);
				c.fadeOut = Math.min(0.03, c.duration / 2);
			}
		});
		const previousTrack = sfxTrackOf(input.previous);
		tracks.push({
			kind: "audio",
			id: TRACK_IDS.sfx,
			name: "Efectos",
			hidden: false,
			locked: false,
			muted: previousTrack?.kind === "audio" ? previousTrack.muted : false,
			clips,
		});
	}

	// Pistas que no genera el guion (capas libres del editor) se conservan, recortadas al video:
	// si el guion se acorta, una capa no puede alargarlo con pantalla vacía.
	const generated = new Set<string>(Object.values(TRACK_IDS));
	for (const track of input.previous?.tracks ?? []) {
		if (generated.has(track.id)) continue;
		const clips = track.clips
			.filter((c) => c.start < total - 0.05)
			.map((c) => (c.start + c.duration > total ? { ...c, duration: total - c.start } : c));
		if (clips.length > 0) tracks.push({ ...track, clips } as Track);
	}

	return storyboardSchema.parse({
		version: STORYBOARD_VERSION,
		title: input.script.title,
		language: input.language,
		format: input.format,
		fps: input.fps ?? input.previous?.fps ?? 30,
		style: input.style,
		tracks,
	} satisfies StoryboardInput);
};

/** Lee el guion de vuelta desde un storyboard, con los ids y ajustes de cada escena. */
export const scriptFromStoryboard = (sb: Storyboard): Script => ({
	title: sb.title,
	scenes: sceneClips(sb).map((c) => {
		const settings: SceneSettings = {
			...(c.theme?.accent ? { accent: c.theme.accent } : {}),
			...(c.theme?.background ? { background: c.theme.background } : {}),
			...(c.enter ? { enter: c.enter.type } : {}),
			...(c.exit
				? c.exit.type === "fade"
					? {}
					: { exit: c.exit.type }
				: { exit: "none" as const }),
			...(c.extraTime ? { extraTime: c.extraTime } : {}),
		};
		return {
			id: c.id,
			narration: c.narration ?? "",
			content: c.content,
			...(Object.keys(settings).length ? { settings } : {}),
		};
	}),
});

/** Ajustes del video que no son del guion: subtítulos, llamada a la acción y música. */
export type VideoSettings = {
	captions: VideoStyle["captions"];
	/** Estilo visual del video; al aplicar, si falta se conserva el que tenga. */
	visualStyle?: VisualStyle;
	ctaText: string;
	music: MusicSettings | null;
	/** Efectos de sonido (null = sin efectos). Opcional al aplicar: sin él se conservan. */
	sfx?: SfxSettings | null;
};

export const videoSettingsFromStoryboard = (sb: Storyboard): VideoSettings => ({
	captions: { ...sb.style.captions },
	visualStyle: resolveVisualStyle(sb.style.visualStyle),
	ctaText: ctaOf(sb),
	music: musicOf(sb),
	sfx: sfxOf(sb),
});

export const videoSettingsSchema = z.object({
	captions: z.object({ enabled: z.boolean(), maxWordsPerPage: z.number().int().min(1).max(8) }),
	ctaText: z.string().trim().max(120),
	/** Estilo visual del video (opcional: sin él se conserva el que tenga). */
	visualStyle: visualStyleSchema.optional(),
	music: z
		.object({
			src: z.string().min(1),
			label: z.string(),
			volume: z.number().min(MUSIC_VOLUME_RANGE.min).max(MUSIC_VOLUME_RANGE.max),
			fadeIn: z.number().min(0).max(10),
			fadeOut: z.number().min(0).max(10),
		})
		.nullable(),
	sfx: z
		.object({ volume: z.number().min(SFX_VOLUME_RANGE.min).max(SFX_VOLUME_RANGE.max) })
		.nullable()
		.optional(),
});

/** Aplica los ajustes del video conservando guion, voces y demás ediciones. */
export const applyVideoSettings = (sb: Storyboard, input: VideoSettings): Storyboard => {
	const settings = videoSettingsSchema.parse(input);
	return assembleStoryboard({
		script: scriptFromStoryboard(sb),
		language: sb.language,
		format: sb.format,
		style: {
			...sb.style,
			captions: settings.captions,
			visualStyle: settings.visualStyle
				? resolveVisualStyle(settings.visualStyle)
				: sb.style.visualStyle,
		},
		ctaText: settings.ctaText,
		music: settings.music,
		sfx: settings.sfx,
		previous: sb,
	});
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

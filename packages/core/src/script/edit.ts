import { z } from "zod";
import type { AudioClip, Storyboard } from "../storyboard/schema";
import { findClip, storyboardDuration } from "../storyboard/timeline";
import {
	assembleStoryboard,
	CTA_SECONDS_RANGE,
	EXTRA_TIME_RANGE,
	scriptFromStoryboard,
} from "./script";

// Ediciones directas sobre la línea de tiempo y los subtítulos (editor v2).
// Son funciones puras: storyboard → storyboard nuevo. El proceso principal las guarda como versión.

const round = (n: number, step = 0.1) => Math.round(n / step) * step;

export const timelineEditSchema = z.discriminatedUnion("type", [
	/** Arrastrar el borde derecho de una escena: lo que pase de la voz es pausa extra. */
	z.object({
		type: z.literal("sceneDuration"),
		sceneId: z.string(),
		duration: z.number().positive(),
	}),
	/** Soltar una escena en otra posición de la pista. */
	z.object({ type: z.literal("moveScene"), sceneId: z.string(), toIndex: z.number().int().min(0) }),
	/** Mover o recortar la llamada a la acción. */
	z.object({
		type: z.literal("ctaTiming"),
		start: z.number().min(0),
		duration: z.number().positive(),
	}),
]);
export type TimelineEdit = z.infer<typeof timelineEditSchema>;

const rebuild = (sb: Storyboard, script: ReturnType<typeof scriptFromStoryboard>) =>
	assembleStoryboard({
		script,
		language: sb.language,
		format: sb.format,
		style: sb.style,
		previous: sb,
	});

/** Lo mínimo que puede durar una escena: su voz (o la estimación) sin pausa extra. */
export const sceneMinDuration = (sb: Storyboard, sceneId: string): number => {
	const clip = findClip(sb, sceneId)?.clip;
	if (clip?.type !== "scene") throw new Error(`No existe la escena ${sceneId}`);
	return clip.duration - clip.extraTime;
};

export const applyTimelineEdit = (sb: Storyboard, input: TimelineEdit): Storyboard => {
	const edit = timelineEditSchema.parse(input);
	switch (edit.type) {
		case "sceneDuration": {
			const extraTime = Math.min(
				EXTRA_TIME_RANGE.max,
				Math.max(0, round(edit.duration - sceneMinDuration(sb, edit.sceneId))),
			);
			const script = scriptFromStoryboard(sb);
			return rebuild(sb, {
				...script,
				scenes: script.scenes.map((s) =>
					s.id === edit.sceneId ? { ...s, settings: { ...s.settings, extraTime } } : s,
				),
			});
		}
		case "moveScene": {
			const script = scriptFromStoryboard(sb);
			const from = script.scenes.findIndex((s) => s.id === edit.sceneId);
			if (from < 0) throw new Error(`No existe la escena ${edit.sceneId}`);
			const scenes = [...script.scenes];
			const [scene] = scenes.splice(from, 1);
			if (scene) scenes.splice(Math.min(edit.toIndex, scenes.length), 0, scene);
			return rebuild(sb, { ...script, scenes });
		}
		case "ctaTiming": {
			const total = storyboardDuration(sb);
			const duration = Math.min(
				Math.max(round(edit.duration), CTA_SECONDS_RANGE.min),
				CTA_SECONDS_RANGE.max,
				total,
			);
			const start = Math.min(Math.max(0, round(edit.start)), total - duration);
			return {
				...sb,
				tracks: sb.tracks.map((t) =>
					t.kind === "visual"
						? { ...t, clips: t.clips.map((c) => (c.id === "cta" ? { ...c, start, duration } : c)) }
						: t,
				),
			};
		}
	}
};

/** Lo que el editor de subtítulos puede cambiar de cada palabra (el texto locutado no). */
export const captionEditSchema = z.array(
	z.object({ start: z.number().min(0), end: z.number().min(0), display: z.string().optional() }),
);
export type CaptionEdit = z.infer<typeof captionEditSchema>;

export const voiceClipOf = (sb: Storyboard, sceneId: string): AudioClip | undefined =>
	sb.tracks
		.flatMap((t) => (t.kind === "audio" ? t.clips : []))
		.find((c) => c.role === "voice" && c.linkedTo === sceneId);

/**
 * Corrige los subtítulos de una escena: texto a mostrar y tiempos de cada palabra.
 * Los tiempos son relativos al audio de la voz y no pueden salirse de él ni desordenarse.
 */
export const updateCaptions = (sb: Storyboard, sceneId: string, input: CaptionEdit): Storyboard => {
	const edits = captionEditSchema.parse(input);
	const voice = voiceClipOf(sb, sceneId);
	if (!voice?.words) throw new Error("Esta escena aún no tiene voz: genera la voz primero");
	if (edits.length !== voice.words.length)
		throw new Error("El número de palabras no coincide con la voz");
	const limit = voice.duration + 0.05;
	let previousStart = 0;
	const words = voice.words.map((word, i) => {
		const edit = edits[i] as CaptionEdit[number];
		const start = Math.round(edit.start * 1000) / 1000;
		const end = Math.round(edit.end * 1000) / 1000;
		if (end <= start) throw new Error(`"${word.text}": el final debe ser posterior al inicio`);
		if (end > limit) throw new Error(`"${word.text}": termina después de que acabe la voz`);
		if (start < previousStart)
			throw new Error(`"${word.text}": empieza antes que la palabra anterior`);
		previousStart = start;
		const display = edit.display?.trim();
		return {
			text: word.text,
			start,
			end,
			...(display && display !== word.text ? { display } : {}),
		};
	});
	return {
		...sb,
		tracks: sb.tracks.map((t) =>
			t.kind === "audio"
				? { ...t, clips: t.clips.map((c) => (c.id === voice.id ? { ...c, words } : c)) }
				: t,
		),
	};
};

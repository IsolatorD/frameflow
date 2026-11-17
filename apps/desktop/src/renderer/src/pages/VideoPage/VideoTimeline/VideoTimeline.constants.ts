import { CTA_SECONDS_RANGE, EXTRA_TIME_RANGE } from "@frameflow/core/script";
import { sceneMinDuration, type TimelineEdit } from "@frameflow/core/script/edit";
import type { Clip, SceneClip, Storyboard } from "@frameflow/core/storyboard";
import { findClip } from "@frameflow/core/storyboard/timeline";
import type { TimelineTrack } from "@frameflow/ui/src/organisms/Timeline/TimelineInterface";

/** Qué representa cada clip de la línea de tiempo, para saber qué abrir al pulsarlo. */
export type ClipTarget = { kind: "scene"; sceneId: string } | { kind: "settings" };

/** Storyboard → pistas de la línea de tiempo (con avisos de escenas sin voz). */
export const timelineTracks = (
	sb: Storyboard,
	voicedSceneIds: readonly string[],
): TimelineTrack[] => {
	const showVoiceWarnings = voicedSceneIds.length > 0;
	let sceneNumber = 0;
	return sb.tracks
		.filter((t) => !t.hidden && t.clips.length > 0)
		.map((track) => ({
			id: track.id,
			label: track.name || track.id,
			clips: track.clips.map((clip) => {
				switch (clip.type) {
					case "scene": {
						sceneNumber++;
						const text =
							clip.content.type === "stat"
								? `${clip.content.value}${clip.content.suffix ?? ""}`
								: clip.content.lines.map((l) => l.text).join(" ");
						return {
							id: clip.id,
							start: clip.start,
							duration: clip.duration,
							label: `${sceneNumber} · ${text}`,
							kind: "scene" as const,
							warning: showVoiceWarnings && !voicedSceneIds.includes(clip.id),
							editable: {
								move: true,
								trimEnd: {
									min: clip.duration - clip.extraTime,
									max: clip.duration - clip.extraTime + EXTRA_TIME_RANGE.max,
								},
							},
						};
					}
					case "audio":
						return {
							id: clip.id,
							start: clip.start,
							duration: clip.duration,
							label:
								clip.role === "music"
									? `♪ ${clip.label ?? "Música"}`
									: (clip.words?.map((w) => w.text).join(" ") ?? "Voz"),
							kind: clip.role === "music" ? ("music" as const) : ("voice" as const),
						};
					case "text":
						return {
							id: clip.id,
							start: clip.start,
							duration: clip.duration,
							label: clip.text,
							kind: "text" as const,
							editable:
								clip.id === "cta"
									? {
											move: true,
											trimEnd: { min: CTA_SECONDS_RANGE.min, max: CTA_SECONDS_RANGE.max },
										}
									: undefined,
						};
					default:
						return {
							id: clip.id,
							start: clip.start,
							duration: clip.duration,
							label: clip.type,
							kind: "text" as const,
						};
				}
			}),
		}));
};

/** Al pulsar un clip: las escenas y sus voces abren la escena; música y textos, los ajustes. */
export const clipTarget = (sb: Storyboard, clipId: string): ClipTarget => {
	for (const track of sb.tracks) {
		const clip = track.clips.find((c) => c.id === clipId);
		if (!clip) continue;
		if (clip.type === "scene") return { kind: "scene", sceneId: clip.id };
		if (clip.type === "audio" && clip.role === "voice" && clip.linkedTo)
			return { kind: "scene", sceneId: clip.linkedTo };
	}
	return { kind: "settings" };
};

const sceneClips = (sb: Storyboard): SceneClip[] =>
	sb.tracks
		.flatMap((t): Clip[] => t.clips)
		.filter((c): c is SceneClip => c.type === "scene")
		.sort((a, b) => a.start - b.start);

/** Arrastrar un clip → operación del núcleo (o null si no cambia nada). */
export const moveEdit = (sb: Storyboard, clipId: string, start: number): TimelineEdit | null => {
	const clip = findClip(sb, clipId)?.clip;
	if (!clip) return null;
	if (clip.type === "scene") {
		// La escena va donde cae su centro, entre las demás.
		const center = start + clip.duration / 2;
		const others = sceneClips(sb).filter((c) => c.id !== clipId);
		const toIndex = others.filter((c) => c.start + c.duration / 2 < center).length;
		const from = sceneClips(sb).findIndex((c) => c.id === clipId);
		return toIndex === from ? null : { type: "moveScene", sceneId: clipId, toIndex };
	}
	if (clip.id === "cta") return { type: "ctaTiming", start, duration: clip.duration };
	return null;
};

/** Recortar el borde derecho de un clip → operación del núcleo. */
export const trimEdit = (sb: Storyboard, clipId: string, duration: number): TimelineEdit | null => {
	const clip = findClip(sb, clipId)?.clip;
	if (!clip) return null;
	if (clip.type === "scene") {
		sceneMinDuration(sb, clipId); // valida que exista
		return { type: "sceneDuration", sceneId: clipId, duration };
	}
	if (clip.id === "cta") return { type: "ctaTiming", start: clip.start, duration };
	return null;
};

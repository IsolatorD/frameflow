import type { Storyboard } from "@frameflow/core/storyboard";
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

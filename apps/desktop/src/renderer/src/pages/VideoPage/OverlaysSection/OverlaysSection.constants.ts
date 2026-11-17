import { isOverlayTrack, type OverlayPatch } from "@frameflow/core/script/overlays";
import type { Storyboard, VisualClip } from "@frameflow/core/storyboard";
import { findClip } from "@frameflow/core/storyboard/timeline";
import type { OverlayDraft } from "@frameflow/ui/src/organisms/OverlayInspector/OverlayInspectorInterface";
import type { OverlayListItem } from "@frameflow/ui/src/organisms/OverlayList/OverlayListInterface";
import { formatClock } from "@frameflow/ui/src/organisms/Timeline/Timeline.constants";

export const COLOR_OPTIONS = [
	{ value: "text", label: "Texto" },
	{ value: "accent", label: "Acento" },
	{ value: "muted", label: "Secundario" },
	{ value: "background", label: "Fondo" },
] as const;

const TRANSITION_SECONDS = 0.4;

const overlayLabel = (clip: VisualClip) =>
	clip.type === "text" ? clip.text : (clip.label ?? (clip.type === "image" ? "Imagen" : "Video"));

export const overlayItems = (sb: Storyboard): OverlayListItem[] =>
	sb.tracks.filter(isOverlayTrack).flatMap((track) =>
		(track.clips as VisualClip[])
			.filter(
				(c): c is Extract<VisualClip, { type: "text" | "image" | "video" }> => c.type !== "scene",
			)
			.map((clip) => ({
				id: clip.id,
				type: clip.type,
				label: overlayLabel(clip),
				detail: `${formatClock(clip.start)}–${formatClock(clip.start + clip.duration)} · ${track.name}`,
			})),
	);

/** Capa guardada → borrador del inspector. */
export const overlayDraftOf = (sb: Storyboard, clipId: string): OverlayDraft | null => {
	const clip = findClip(sb, clipId)?.clip;
	if (!clip || (clip.type !== "text" && clip.type !== "image" && clip.type !== "video"))
		return null;
	const transform = { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1, ...clip.transform };
	const base = {
		type: clip.type,
		label: overlayLabel(clip),
		transform,
		enter: clip.enter?.type ?? "none",
		exit: clip.exit?.type ?? "none",
	};
	if (clip.type === "text") return { ...base, text: clip.text, style: { ...clip.style } };
	if (clip.type === "image") return { ...base, fit: clip.fit };
	return {
		...base,
		fit: clip.fit,
		volume: clip.volume,
		trimStart: clip.trimStart,
		sourceDuration: clip.sourceDuration,
	};
};

/** Borrador del inspector → cambios para el núcleo. */
export const draftToPatch = (draft: OverlayDraft): OverlayPatch => ({
	transform: draft.transform,
	enter: draft.enter === "none" ? undefined : { type: draft.enter, duration: TRANSITION_SECONDS },
	exit: draft.exit === "none" ? undefined : { type: draft.exit, duration: TRANSITION_SECONDS },
	...(draft.type === "text" ? { text: draft.text, style: draft.style } : {}),
	...(draft.type !== "text" ? { fit: draft.fit } : {}),
	...(draft.type === "video" ? { volume: draft.volume, trimStart: draft.trimStart } : {}),
});

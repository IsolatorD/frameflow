import { isOverlayTrack, type OverlayPatch } from "@frameflow/core/script/overlays";
import type { Storyboard, VisualClip } from "@frameflow/core/storyboard";
import { removeKeyframe, transformAt, upsertKeyframe } from "@frameflow/core/storyboard/keyframes";
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
		...(clip.keyframes?.length
			? {
					keyframes: clip.keyframes.map((k) => ({
						at: k.at,
						transform: { ...k.transform },
						easing: k.easing,
					})),
				}
			: {}),
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
	keyframes: draft.keyframes ?? [],
	enter: draft.enter === "none" ? undefined : { type: draft.enter, duration: TRANSITION_SECONDS },
	exit: draft.exit === "none" ? undefined : { type: draft.exit, duration: TRANSITION_SECONDS },
	...(draft.type === "text" ? { text: draft.text, style: draft.style } : {}),
	...(draft.type !== "text" ? { fit: draft.fit } : {}),
	...(draft.type === "video" ? { volume: draft.volume, trimStart: draft.trimStart } : {}),
});

// ── Animación: el inspector y la vista previa trabajan con la transformación "del instante" ──

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Borrador tal como se ve en el segundo `t` de la capa (con animación, su transformación ahí). */
export const effectiveDraft = (draft: OverlayDraft, t: number): OverlayDraft =>
	draft.keyframes?.length ? { ...draft, transform: transformAt(draft, t) } : draft;

/**
 * Devuelve un cambio hecho sobre el borrador "del instante" al borrador real: si la capa está
 * animada y cambió la transformación, se crea/ajusta el fotograma de ese instante.
 */
export const writeBack = (raw: OverlayDraft, edited: OverlayDraft, t: number): OverlayDraft => {
	if (!raw.keyframes?.length) return edited;
	const changed = !same(edited.transform, transformAt(raw, t));
	return {
		...edited,
		transform: raw.transform,
		keyframes: changed ? upsertKeyframe(raw.keyframes, t, edited.transform) : raw.keyframes,
	};
};

export const toggleAnimation = (raw: OverlayDraft, on: boolean, t: number): OverlayDraft =>
	on
		? { ...raw, keyframes: upsertKeyframe([], t, raw.transform) }
		: { ...raw, transform: transformAt(raw, t), keyframes: undefined };

export const addKeyframeHere = (raw: OverlayDraft, t: number): OverlayDraft => ({
	...raw,
	keyframes: upsertKeyframe(raw.keyframes ?? [], t, transformAt(raw, t)),
});

export const removeKeyframeHere = (raw: OverlayDraft, t: number): OverlayDraft => {
	const keyframes = removeKeyframe(raw.keyframes ?? [], t);
	return keyframes.length
		? { ...raw, keyframes }
		: { ...raw, transform: transformAt(raw, t), keyframes: undefined };
};

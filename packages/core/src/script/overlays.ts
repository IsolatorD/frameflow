import { z } from "zod";
import {
	type Clip,
	EPSILON,
	keyframeSchema,
	type Storyboard,
	storyboardSchema,
	type Track,
	transformSchema,
	transitionSchema,
	type VisualClip,
	type VisualTrack,
} from "../storyboard/schema";
import { findClip, storyboardDuration } from "../storyboard/timeline";

// Capas libres del editor v3: textos, imágenes y videos que el usuario pone encima del video.
// Viven en pistas "track-overlay-N" (las demás pistas las genera el guion y no se tocan aquí).

export const OVERLAY_PREFIX = "track-overlay-";
export const isOverlayTrack = (track: Track) =>
	track.kind === "visual" && track.id.startsWith(OVERLAY_PREFIX);
export const OVERLAY_SECONDS = { min: 0.5, default: 3 } as const;

export const isOverlayClip = (sb: Storyboard, clipId: string): boolean => {
	const found = findClip(sb, clipId);
	return Boolean(found && isOverlayTrack(found.track));
};

const round = (n: number) => Math.round(n * 10) / 10;
const end = (c: Clip) => c.start + c.duration;
const overlaps = (clips: readonly Clip[], start: number, duration: number, ignore?: string) =>
	clips.some(
		(c) => c.id !== ignore && start < end(c) - EPSILON && c.start < start + duration - EPSILON,
	);

const overlayTracks = (sb: Storyboard) => sb.tracks.filter(isOverlayTrack) as VisualTrack[];

const nextTrackId = (sb: Storyboard) => {
	let n = 1;
	while (sb.tracks.some((t) => t.id === `${OVERLAY_PREFIX}${n}`)) n++;
	return `${OVERLAY_PREFIX}${n}`;
};

/** Un id de clip que no existe aún ("text-1", "image-2"…). */
export const newClipId = (sb: Storyboard, prefix: string) => {
	let n = 1;
	while (findClip(sb, `${prefix}-${n}`)) n++;
	return `${prefix}-${n}`;
};

/** Coloca un clip en la primera capa donde quepa; si no cabe en ninguna, crea una capa encima. */
const place = (sb: Storyboard, clip: VisualClip): Storyboard => {
	const free = overlayTracks(sb).find((t) => !overlaps(t.clips, clip.start, clip.duration));
	if (free) {
		return {
			...sb,
			tracks: sb.tracks.map((t) =>
				t.id === free.id
					? { ...free, clips: [...free.clips, clip].sort((a, b) => a.start - b.start) }
					: t,
			),
		};
	}
	const n = overlayTracks(sb).length + 1;
	const track: VisualTrack = {
		kind: "visual",
		id: nextTrackId(sb),
		name: `Capa ${n}`,
		hidden: false,
		locked: false,
		clips: [clip],
	};
	return { ...sb, tracks: [...sb.tracks, track] };
};

export const newOverlaySchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("text"), text: z.string().trim().min(1, "Escribe el texto") }),
	z.object({ type: z.literal("image"), src: z.string().min(1), label: z.string().optional() }),
	z.object({
		type: z.literal("video"),
		src: z.string().min(1),
		label: z.string().optional(),
		sourceDuration: z.number().positive().optional(),
	}),
]);
export type NewOverlay = z.infer<typeof newOverlaySchema>;

/** Añade una capa empezando en `at` (normalmente donde está el cabezal). Devuelve también su id. */
export const addOverlay = (
	sb: Storyboard,
	input: NewOverlay,
	at: number,
): { storyboard: Storyboard; clipId: string } => {
	const item = newOverlaySchema.parse(input);
	const total = storyboardDuration(sb);
	const wanted =
		item.type === "video" && item.sourceDuration
			? Math.min(item.sourceDuration, 10)
			: OVERLAY_SECONDS.default;
	const duration = round(Math.max(OVERLAY_SECONDS.min, Math.min(wanted, total)));
	const start = round(Math.min(Math.max(0, at), Math.max(0, total - duration)));
	const transform = {
		x: 0.5,
		y: item.type === "text" ? 0.3 : 0.5,
		scale: item.type === "text" ? 1 : 0.6,
		rotation: 0,
		opacity: 1,
	};
	const enter = { type: "pop" as const, duration: 0.4 };
	const exit = { type: "fade" as const, duration: 0.3 };
	const clipId = newClipId(sb, item.type);
	const clip: VisualClip =
		item.type === "text"
			? {
					type: "text",
					id: clipId,
					start,
					duration,
					text: item.text,
					transform,
					enter,
					exit,
					style: { fontSize: 72, fontWeight: 800, color: "text", align: "center" },
				}
			: item.type === "image"
				? {
						type: "image",
						id: clipId,
						start,
						duration,
						src: item.src,
						label: item.label,
						fit: "contain",
						transform,
						enter,
						exit,
					}
				: {
						type: "video",
						id: clipId,
						start,
						duration,
						src: item.src,
						label: item.label,
						trimStart: 0,
						fit: "cover",
						volume: 0,
						playbackRate: 1,
						sourceDuration: item.sourceDuration,
						transform,
						enter,
						exit,
					};
	return { storyboard: storyboardSchema.parse(place(sb, clip)), clipId };
};

/** Lo que el inspector puede cambiar de una capa. */
export const overlayPatchSchema = z
	.object({
		text: z.string().trim().min(1, "El texto no puede quedar vacío"),
		style: z.object({
			fontSize: z.number().min(16).max(240),
			fontWeight: z.number().int().min(100).max(900),
			color: z.string().min(1),
			background: z.string().optional(),
			align: z.enum(["left", "center", "right"]),
		}),
		transform: transformSchema.required(),
		/** Lista completa de fotogramas (vacía = sin animación). */
		keyframes: z.array(keyframeSchema),
		enter: transitionSchema.optional(),
		exit: transitionSchema.optional(),
		fit: z.enum(["cover", "contain"]),
		volume: z.number().min(0).max(2),
		trimStart: z.number().min(0),
	})
	.partial();
export type OverlayPatch = z.infer<typeof overlayPatchSchema>;

const mapOverlay = (
	sb: Storyboard,
	clipId: string,
	fn: (clip: VisualClip, track: VisualTrack) => VisualClip | null,
) => {
	const found = findClip(sb, clipId);
	if (!found || !isOverlayTrack(found.track))
		throw new Error("Solo se pueden editar las capas que añadiste");
	const track = found.track as VisualTrack;
	return {
		...sb,
		tracks: sb.tracks.flatMap((t) => {
			if (t.id !== track.id) return [t];
			const clips = track.clips.flatMap((c) => {
				if (c.id !== clipId) return [c];
				const next = fn(c, track);
				return next ? [next] : [];
			});
			return clips.length ? [{ ...track, clips }] : []; // una capa vacía desaparece
		}),
	};
};

/** Cambia propiedades de una capa (solo las que aplican a su tipo). */
export const updateOverlay = (sb: Storyboard, clipId: string, input: OverlayPatch): Storyboard => {
	const patch = overlayPatchSchema.parse(input);
	return storyboardSchema.parse(
		mapOverlay(sb, clipId, (clip) => {
			const common = {
				...(patch.transform ? { transform: patch.transform } : {}),
				...(patch.keyframes
					? {
							keyframes: patch.keyframes.length
								? [...patch.keyframes].sort((a, b) => a.at - b.at)
								: undefined,
						}
					: {}),
				...("enter" in patch ? { enter: patch.enter } : {}),
				...("exit" in patch ? { exit: patch.exit } : {}),
			};
			switch (clip.type) {
				case "text":
					return {
						...clip,
						...common,
						...(patch.text ? { text: patch.text } : {}),
						...(patch.style ? { style: patch.style } : {}),
					};
				case "image":
					return { ...clip, ...common, ...(patch.fit ? { fit: patch.fit } : {}) };
				case "video": {
					const trimStart =
						patch.trimStart === undefined
							? clip.trimStart
							: Math.min(
									patch.trimStart,
									Math.max(
										0,
										(clip.sourceDuration ?? Number.POSITIVE_INFINITY) - OVERLAY_SECONDS.min,
									),
								);
					return {
						...clip,
						...common,
						...(patch.fit ? { fit: patch.fit } : {}),
						...(patch.volume !== undefined ? { volume: patch.volume } : {}),
						trimStart,
					};
				}
				default:
					return clip;
			}
		}),
	);
};

/** Límites para mover/recortar una capa sin pisar a sus vecinas de pista ni salir del video. */
export const overlayLimits = (sb: Storyboard, clipId: string) => {
	const found = findClip(sb, clipId);
	if (!found) throw new Error(`No existe el clip ${clipId}`);
	const { clip, track } = found;
	const others = track.clips.filter((c) => c.id !== clipId);
	const prevEnd = Math.max(0, ...others.filter((c) => c.start < clip.start).map(end));
	const total = storyboardDuration({ ...sb, tracks: sb.tracks.filter((t) => !isOverlayTrack(t)) });
	const nextStart = Math.min(
		total,
		...others.filter((c) => c.start > clip.start).map((c) => c.start),
	);
	const sourceLeft =
		clip.type === "video" && clip.sourceDuration
			? clip.sourceDuration - clip.trimStart
			: Number.POSITIVE_INFINITY;
	return {
		minStart: prevEnd,
		maxStart: Math.max(prevEnd, nextStart - clip.duration),
		minDuration: OVERLAY_SECONDS.min,
		maxDuration: Math.max(OVERLAY_SECONDS.min, Math.min(nextStart - clip.start, sourceLeft)),
	};
};

export const moveOverlay = (sb: Storyboard, clipId: string, start: number): Storyboard => {
	const limits = overlayLimits(sb, clipId);
	const next = round(Math.min(Math.max(start, limits.minStart), limits.maxStart));
	return storyboardSchema.parse(mapOverlay(sb, clipId, (c) => ({ ...c, start: next })));
};

export const trimOverlay = (sb: Storyboard, clipId: string, duration: number): Storyboard => {
	const limits = overlayLimits(sb, clipId);
	const next = round(Math.min(Math.max(duration, limits.minDuration), limits.maxDuration));
	// Los fotogramas que quedan fuera del clip recortado sobran.
	return storyboardSchema.parse(
		mapOverlay(sb, clipId, (c) => ({
			...c,
			duration: next,
			keyframes: c.keyframes?.some((k) => k.at > next)
				? c.keyframes.filter((k) => k.at <= next + 1e-6)
				: c.keyframes,
		})),
	);
};

/** Duplica una capa justo a continuación (o en otra capa si no cabe). */
export const duplicateOverlay = (
	sb: Storyboard,
	clipId: string,
): { storyboard: Storyboard; clipId: string } => {
	const found = findClip(sb, clipId);
	if (!found || !isOverlayTrack(found.track))
		throw new Error("Solo se pueden duplicar las capas que añadiste");
	const source = found.clip as VisualClip;
	const total = storyboardDuration(sb);
	const id = newClipId(sb, source.type);
	const afterStart = end(source);
	const start = afterStart + source.duration <= total + EPSILON ? afterStart : source.start;
	return { storyboard: storyboardSchema.parse(place(sb, { ...source, id, start })), clipId: id };
};

export const deleteOverlay = (sb: Storyboard, clipId: string): Storyboard =>
	storyboardSchema.parse(mapOverlay(sb, clipId, () => null));

/** Todas las operaciones sobre capas en una sola entrada (lo que viaja por IPC). */
export const overlayOpSchema = z.discriminatedUnion("op", [
	z.object({ op: z.literal("add"), item: newOverlaySchema, at: z.number().min(0) }),
	z.object({ op: z.literal("update"), clipId: z.string(), patch: overlayPatchSchema }),
	z.object({ op: z.literal("move"), clipId: z.string(), start: z.number() }),
	z.object({ op: z.literal("trim"), clipId: z.string(), duration: z.number() }),
	z.object({ op: z.literal("duplicate"), clipId: z.string() }),
	z.object({ op: z.literal("delete"), clipId: z.string() }),
]);
export type OverlayOp = z.infer<typeof overlayOpSchema>;

/** Aplica una operación; devuelve el storyboard y la capa a seleccionar después (si hay). */
export const applyOverlayOp = (
	sb: Storyboard,
	input: OverlayOp,
): { storyboard: Storyboard; clipId: string | null } => {
	const op = overlayOpSchema.parse(input);
	switch (op.op) {
		case "add":
			return addOverlay(sb, op.item, op.at);
		case "update":
			return { storyboard: updateOverlay(sb, op.clipId, op.patch), clipId: op.clipId };
		case "move":
			return { storyboard: moveOverlay(sb, op.clipId, op.start), clipId: op.clipId };
		case "trim":
			return { storyboard: trimOverlay(sb, op.clipId, op.duration), clipId: op.clipId };
		case "duplicate":
			return duplicateOverlay(sb, op.clipId);
		case "delete":
			return { storyboard: deleteOverlay(sb, op.clipId), clipId: null };
	}
};

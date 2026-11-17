import type { Easing, Keyframe, Transform } from "./schema";

// Animación por fotogramas clave: funciones puras que usan el renderer, la vista previa y el editor.

export const DEFAULT_TRANSFORM: Transform = { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1 };
/** Dos fotogramas a menos de esto se consideran el mismo instante. */
export const KEYFRAME_TOLERANCE = 0.05;

/** Curvas de animación (progreso 0–1 → progreso con curva 0–1). Cúbicas, como en CSS. */
export const EASINGS: Record<Easing, (p: number) => number> = {
	ease: (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2),
	"ease-in": (p) => p * p * p,
	"ease-out": (p) => 1 - (1 - p) ** 3,
	linear: (p) => p,
};
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

const sorted = (keyframes: readonly Keyframe[]) => [...keyframes].sort((a, b) => a.at - b.at);

/** Posición/aspecto de una capa en el segundo `t` desde su inicio. */
export const transformAt = (
	clip: { transform?: Transform; keyframes?: readonly Keyframe[] },
	t: number,
): Transform => {
	const base = { ...DEFAULT_TRANSFORM, ...clip.transform };
	if (!clip.keyframes?.length) return base;
	const frames = sorted(clip.keyframes);
	const first = frames[0] as Keyframe;
	const last = frames[frames.length - 1] as Keyframe;
	if (t <= first.at) return first.transform;
	if (t >= last.at) return last.transform;
	const i = frames.findIndex((k) => k.at > t);
	const a = frames[i - 1] as Keyframe;
	const b = frames[i] as Keyframe;
	const raw = (t - a.at) / Math.max(1e-6, b.at - a.at);
	const p = EASINGS[b.easing](raw);
	return {
		x: lerp(a.transform.x, b.transform.x, p),
		y: lerp(a.transform.y, b.transform.y, p),
		scale: lerp(a.transform.scale, b.transform.scale, p),
		rotation: lerp(a.transform.rotation, b.transform.rotation, p),
		opacity: lerp(a.transform.opacity, b.transform.opacity, p),
	};
};

/** Pone (o reemplaza, si ya hay uno en ese instante) un fotograma clave. */
export const upsertKeyframe = (
	keyframes: readonly Keyframe[],
	at: number,
	transform: Transform,
): Keyframe[] => {
	const time = Math.max(0, Math.round(at * 100) / 100);
	const existing = keyframes.find((k) => Math.abs(k.at - time) < KEYFRAME_TOLERANCE);
	return sorted(
		existing
			? keyframes.map((k) => (k === existing ? { ...k, transform } : k))
			: [...keyframes, { at: time, transform, easing: "ease" }],
	);
};

export const removeKeyframe = (keyframes: readonly Keyframe[], at: number): Keyframe[] =>
	keyframes.filter((k) => Math.abs(k.at - at) >= KEYFRAME_TOLERANCE);

/** Fotograma en el instante `at` (con tolerancia), si existe. */
export const keyframeAt = (keyframes: readonly Keyframe[] | undefined, at: number) =>
	keyframes?.find((k) => Math.abs(k.at - at) < KEYFRAME_TOLERANCE);

/** Cambia la curva con la que se llega al fotograma del instante `at`. */
export const setKeyframeEasing = (
	keyframes: readonly Keyframe[],
	at: number,
	easing: Easing,
): Keyframe[] =>
	keyframes.map((k) => (Math.abs(k.at - at) < KEYFRAME_TOLERANCE ? { ...k, easing } : k));

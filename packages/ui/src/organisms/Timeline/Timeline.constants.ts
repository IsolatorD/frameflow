import type { TimelineClipKind } from "./TimelineInterface";

export const CLIP_COLORS: Record<TimelineClipKind, string> = {
	scene: "bg-violet-500/25 ring-violet-400/50 text-violet-100",
	voice: "bg-emerald-500/20 ring-emerald-400/40 text-emerald-100",
	music: "bg-amber-400/15 ring-amber-400/40 text-amber-100",
	sfx: "bg-orange-400/15 ring-orange-300/40 text-orange-100",
	text: "bg-sky-500/20 ring-sky-400/40 text-sky-100",
	media: "bg-pink-500/20 ring-pink-400/40 text-pink-100",
};

/** Marcas de la regla: cada 1, 5 o 10 s según la duración, con etiqueta cada pocas marcas. */
export const rulerTicks = (duration: number): { at: number; label: string | null }[] => {
	const step = duration <= 20 ? 1 : duration <= 90 ? 5 : 10;
	const labelEvery = duration <= 20 ? 5 : step;
	const ticks = [];
	for (let at = 0; at <= duration + 1e-6; at += step) {
		ticks.push({ at, label: at % labelEvery === 0 ? formatClock(at) : null });
	}
	return ticks;
};

export const formatClock = (seconds: number) => {
	const s = Math.max(0, Math.floor(seconds));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Ajusta a décimas de segundo (la precisión que tiene sentido al arrastrar). */
export const snap = (seconds: number) => Math.round(seconds * 10) / 10;

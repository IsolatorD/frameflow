import { isOverlayTrack } from "@frameflow/core/script/overlays";
import type { Clip, Storyboard } from "@frameflow/core/storyboard";

/** Distancia (en fracción del lienzo) a la que la capa se pega al centro. */
export const SNAP = 0.015;
export const SCALE_RANGE = { min: 0.1, max: 2 } as const;
/** Paso de las flechas del teclado (Mayús = grande). */
export const NUDGE = { small: 0.01, big: 0.05 } as const;
/** Espera tras la última flecha antes de guardar. */
export const NUDGE_COMMIT_MS = 700;

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** Se pega a 0,5 si está cerca; devuelve también si se pegó (para pintar la guía). */
export const snapCenter = (v: number): [number, boolean] =>
	Math.abs(v - 0.5) < SNAP ? [0.5, true] : [round3(clamp(v, 0, 1)), false];

/** Capas visibles en el segundo `t`. */
export const visibleOverlayIds = (sb: Storyboard, t: number): string[] =>
	sb.tracks
		.filter(isOverlayTrack)
		.flatMap((track): Clip[] => track.clips)
		.filter((c) => c.start <= t && t < c.start + c.duration)
		.map((c) => c.id);

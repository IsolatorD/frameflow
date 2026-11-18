// Tipos (escritos para Frameflow) de orbi.js de Lemo-Opuscar (MIT): la sonda Orbi con su pose continua.
export type OrbiPose = {
	/** Giro en grados. */
	rot?: number;
	/** Hacia dónde mira, -1..1. */
	look?: [number, number];
	/** Parpadeo 0..1. */
	lid?: number;
	smile?: number;
	/** El objetivo se alarga (zoom) 0..1. */
	zoom?: number;
	/** Sorpresa: el iris se abre 0..1. */
	wide?: number;
	/** Aplastar (>0) o estirar (<0). */
	sq?: number;
	tilt?: number;
	tl?: number;
	tr?: number;
	ant?: number;
	flame?: number;
	flick?: number;
	hold?: number;
};
export function orbi(p: SVGElement, x: number, y: number, s: number, P?: OrbiPose): SVGGElement;
export function orbiLens(x: number, y: number, s: number, P: OrbiPose): [number, number];

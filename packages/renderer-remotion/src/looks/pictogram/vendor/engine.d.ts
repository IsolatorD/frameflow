// Tipos (escritos para Frameflow) del motor de Pictogram Motion de Lemo-Opuscar (engine.js, MIT).
// Al importarse, engine.js define `window.G`.
type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];
export type Palette = {
	name: string;
	key: string;
	/** Cinco tonos, del más oscuro al más claro. */
	t: [string, string, string, string, string];
	base: string;
	far: string;
	fg: string;
	accent?: string;
};
export type PaletteKey = "navy" | "teal" | "sky" | "coral" | "yellow" | "ink";
export type PictogramEngine = {
	W: number;
	H: number;
	CELL: number;
	CREAM: string;
	INK: string;
	PAL: Record<PaletteKey, Palette>;
	MOTIFS: Record<string, number[]>;
	F: { en: (w: number, px: number) => string; zh: (w: number, px: number) => string; mono: (px: number, w?: number) => string };
	E: Record<"lin" | "io" | "o3" | "i3" | "io3" | "oExp" | "iExp" | "ioExp" | "o5", (t: number) => number> & {
		oBack: (t: number, s?: number) => number;
	};
	clamp: (x: number, a?: number, b?: number) => number;
	lerp: (a: number, b: number, t: number) => number;
	inv: (a: number, b: number, x: number) => number;
	rng: (seed: number) => () => number;
	mix: (a: string, b: string, t: number) => string;
	rgba: (h: string, a: number) => string;
	canvas: (w?: number, h?: number) => HTMLCanvasElement;
	disc: (ctx: Ctx, x: number, y: number, r: number, col: string) => void;
	seg: (ctx: Ctx, a: Pt, b: Pt, w: number, col: string) => void;
	ring: (ctx: Ctx, x: number, y: number, r: number, w: number, col: string) => void;
	poly: (ctx: Ctx, pts: Pt[], col: string) => void;
	rrect: (ctx: Ctx, x: number, y: number, w: number, h: number, r: number, col: string) => void;
	drop: (ctx: Ctx, x: number, y: number, r: number, col: string) => void;
	cloud: (ctx: Ctx, x: number, y: number, s: number, col: string) => void;
	sunIcon: (ctx: Ctx, x: number, y: number, r: number, col: string, spin?: number) => void;
	moon: (ctx: Ctx, x: number, y: number, r: number, col: string) => void;
	bolt: (ctx: Ctx, x: number, y: number, s: number, col: string) => void;
	item: (ctx: Ctx, kind: 0 | 1 | 2 | 3, x: number, y: number, s: number, col: string) => void;
	foot: (ctx: Ctx, x: number, y: number, s: number, ang: number, col: string, mirror?: number) => void;
	umbrella: (
		ctx: Ctx,
		x: number,
		y: number,
		R: number,
		o: number,
		rot: number,
		col: string,
		col2: string,
		sh: string,
	) => void;
	pattern: (
		pk: PaletteKey,
		seed?: number,
		o?: { spread?: number; density?: number; set?: string },
	) => HTMLCanvasElement;
	drawPattern: (ctx: Ctx, pat: HTMLCanvasElement, offs?: (row: number) => number) => void;
	maskText: (
		ctx: Ctx,
		text: string,
		x: number,
		y: number,
		font: string,
		col: string,
		p: number,
		o?: { ls?: string; align?: "left" | "center" | "right" },
	) => number;
	typeText: (
		ctx: Ctx,
		text: string,
		x: number,
		y: number,
		font: string,
		col: string,
		p: number,
		o?: { ls?: string; align?: "left" | "center" | "right" },
	) => void;
};
declare global {
	interface Window {
		G: PictogramEngine;
	}
}

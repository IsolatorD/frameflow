// Tipos (escritos para Frameflow) de flat.js de Lemo-Opuscar (MIT): paleta y ayudas de dibujo plano en SVG.
type Attrs = Record<string, string | number>;
export const C: {
	night: string;
	n2: string;
	n3: string;
	mist: string;
	blue: string;
	blueD: string;
	mint: string;
	mintD: string;
	coral: string;
	coralD: string;
	sun: string;
	sunD: string;
	cream: string;
	creamD: string;
};
export const W: number;
export const H: number;
export function setRoot(root: SVGElement, defs: SVGDefsElement): void;
export function r1(v: number): number;
export function el(tag: string, a?: Attrs, p?: SVGElement | null): SVGElement;
export function g(p?: SVGElement | null, a?: Attrs): SVGGElement;
export function rng(seed: number): () => number;
export function clipOf(tag: string, a: Attrs): string;
export function blobPath(pts: [number, number][]): string;
export function polar(
	cx: number,
	cy: number,
	n: number,
	rf: (a: number) => number,
): [number, number][];
export function shaded(
	p: SVGElement,
	tag: string,
	a: Attrs,
	base: string,
	shade: string,
	dx: number,
	dy: number,
): SVGGElement;
export function sparkle(p: SVGElement, x: number, y: number, r: number, fill: string): void;
export function halo(p: SVGElement, x: number, y: number, r1: number, r2: number): void;
export function text(p: SVGElement, x: number, y: number, html: string, a?: Attrs): SVGTextElement;

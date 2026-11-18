// Tipos (escritos para Frameflow) de las funciones de dibujo de flat-space-explainer (MIT).
export function nextRing(
	p: SVGElement,
	x: number,
	y: number,
	r: number,
	label: string,
	lx: number,
	ly: number,
	anchor?: "start" | "middle" | "end",
): void;
export function galaxy(
	p: SVGElement,
	cx: number,
	cy: number,
	R: number,
	tilt: number,
	sq: number,
	seed: number,
): { at: (ph: number, t: number, off?: number) => [number, number]; r0: number; b: number; th: number };
export function tinyGalaxy(p: SVGElement, x: number, y: number, r: number, rot: number): void;
export function satellite(
	p: SVGElement,
	x: number,
	y: number,
	s: number,
	rot: number,
	body?: string,
	bodyD?: string,
): SVGGElement;
export function bacterium(
	p: SVGElement,
	x: number,
	y: number,
	len: number,
	wid: number,
	rot: number,
	o?: { dim?: boolean; tails?: boolean },
): SVGGElement;
export function rbc(p: SVGElement, x: number, y: number, r: number): void;
export function virusShape(p: SVGElement, x: number, y: number, R: number, rot: number): void;

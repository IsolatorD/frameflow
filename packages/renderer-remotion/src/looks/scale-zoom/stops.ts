import { C, el, g, r1, rng, shaded } from "./vendor/flat.js";
import { bacterium, galaxy, rbc, satellite, virusShape } from "./vendor/objects.js";

// Las "paradas" del viaje de escala: cada escena del video es una parada y la cámara se zambulle
// de una a la siguiente por un anillo. Cada parada se dibuja centrada en (x, y) con un tamaño R en
// píxeles (así los trazos no se deforman al hacer zoom) y declara dónde está la siguiente:
// `target` (desplazamiento en unidades de R desde el centro) y `ring` (radio del anillo, en R).
// Los dibujos usan las primitivas planas de flat-space-explainer (vendor/, MIT).

export type Stop = {
	id: string;
	name: { es: string; en: string };
	/** Fondo: estrellas (espacio) o partículas (dentro del cuerpo). */
	sky: "stars" | "plasma";
	target: [number, number];
	ring: number;
	draw: (p: SVGElement, x: number, y: number, R: number, t: number) => void;
};

/** El Sol en un brazo de la galaxia (la misma cuenta que el original, normalizada a R = 1). */
const GALAXY = { tilt: -16, sq: 0.5, seed: 7 };
const galaxyTarget = ((): [number, number] => {
	const b = 0.29;
	const tt = Math.log(0.56 / 0.085) / b;
	const off = 10 / 560;
	const r = 0.085 * Math.exp(b * tt);
	const a = tt + Math.PI;
	const nx = Math.cos(a) * b - Math.sin(a);
	const ny = Math.sin(a) * b + Math.cos(a);
	const nl = Math.hypot(nx, ny);
	const x = Math.cos(a) * r - (ny / nl) * off;
	const y = (Math.sin(a) * r + (nx / nl) * off) * GALAXY.sq;
	const A = (GALAXY.tilt * Math.PI) / 180;
	return [Math.cos(A) * x - Math.sin(A) * y, Math.sin(A) * x + Math.cos(A) * y];
})();

const deg = (d: number) => (d * Math.PI) / 180;

/** Sistema solar: el Sol a la izquierda, órbitas y planetas; la siguiente parada es la Tierra. */
const SOLAR = {
	sun: [-0.3, 0.05] as [number, number],
	orbits: [
		{ r: 0.36, a: -40, col: C.mist, size: 0.018, speed: 0.12 },
		{ r: 0.58, a: 145, col: C.cream, size: 0.024, speed: 0.07 },
		{ r: 0.86, a: -8, col: C.blue, size: 0.032, speed: 0 },
		{ r: 1.08, a: 205, col: C.coral, size: 0.024, speed: 0.03 },
	],
};
const EARTH_IN_SOLAR: [number, number] = [
	SOLAR.sun[0] + 0.86 * Math.cos(deg(-8)),
	SOLAR.sun[1] + 0.86 * Math.sin(deg(-8)),
];

/** Tierra: disco azul, continentes y nubes (las del original, escaladas a R). */
const EARTH = { r: 0.62, px: 0.62 / (6371 * 0.034) };
const LANDS: [number, number, number, number][] = [
	[-70, -60, 96, 9],
	[40, -150, 52, 7],
	[95, 70, 80, 8],
	[-110, 120, 46, 6],
	[150, -40, 36, 6],
];
const CLOUDS: [number, number, number][] = [
	[-20, -118, 120],
	[60, 20, 150],
	[-120, 40, 90],
	[20, 150, 110],
];

function blob(
	p: SVGElement,
	cx: number,
	cy: number,
	rr: number,
	n: number,
	R: () => number,
	fill: string,
) {
	const pts: [number, number][] = [];
	for (let i = 0; i < n; i++) {
		const a = (i / n) * Math.PI * 2;
		const r = rr * (0.78 + 0.32 * R());
		pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
	}
	// Curva cerrada por los puntos (Catmull-Rom), como blobPath del original.
	let d = `M${r1(pts[0]?.[0] ?? 0)},${r1(pts[0]?.[1] ?? 0)}`;
	for (let i = 0; i < n; i++) {
		const p0 = pts[(i - 1 + n) % n] as [number, number];
		const p1 = pts[i] as [number, number];
		const p2 = pts[(i + 1) % n] as [number, number];
		const p3 = pts[(i + 2) % n] as [number, number];
		d += `C${r1(p1[0] + (p2[0] - p0[0]) / 6)},${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)},${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])},${r1(p2[1])}`;
	}
	el("path", { d: `${d}Z`, fill }, p);
}

export const STOPS: readonly Stop[] = [
	{
		id: "galaxy",
		name: { es: "La galaxia", en: "The galaxy" },
		sky: "stars",
		target: galaxyTarget,
		ring: 0.05,
		draw: (p, x, y, R) => {
			galaxy(p, r1(x), r1(y), R, GALAXY.tilt, GALAXY.sq, GALAXY.seed);
		},
	},
	{
		id: "solar",
		name: { es: "El sistema solar", en: "The solar system" },
		sky: "stars",
		target: EARTH_IN_SOLAR,
		ring: 0.075,
		draw: (p, x, y, R, t) => {
			const sx = x + SOLAR.sun[0] * R;
			const sy = y + SOLAR.sun[1] * R;
			for (const o of SOLAR.orbits)
				el(
					"circle",
					{
						cx: r1(sx),
						cy: r1(sy),
						r: r1(o.r * R),
						fill: "none",
						stroke: C.n3,
						"stroke-width": r1(Math.min(3, Math.max(1.5, R * 0.004))),
					},
					p,
				);
			el("circle", { cx: r1(sx), cy: r1(sy), r: r1(R * 0.34), fill: C.n2 }, p);
			el("circle", { cx: r1(sx), cy: r1(sy), r: r1(R * 0.27), fill: C.n3 }, p);
			shaded(
				p,
				"circle",
				{ cx: r1(sx), cy: r1(sy), r: r1(R * 0.2) },
				C.sun,
				C.sunD,
				R * 0.03,
				R * 0.03,
			);
			el("circle", { cx: r1(sx), cy: r1(sy), r: r1(R * 0.1), fill: C.cream }, p);
			for (const o of SOLAR.orbits) {
				const a = deg(o.a) + t * o.speed;
				el(
					"circle",
					{
						cx: r1(sx + Math.cos(a) * o.r * R),
						cy: r1(sy + Math.sin(a) * o.r * R),
						r: r1(o.size * R),
						fill: o.col,
					},
					p,
				);
			}
		},
	},
	{
		id: "earth",
		name: { es: "La Tierra", en: "The Earth" },
		sky: "stars",
		target: [-70 * EARTH.px * 0.9, -60 * EARTH.px * 0.9],
		ring: 0.06,
		draw: (p, x, y, R, t) => {
			const k = EARTH.px * R;
			el("circle", { cx: r1(x), cy: r1(y), r: r1(R * 0.8), fill: C.n2 }, p);
			el("circle", { cx: r1(x), cy: r1(y), r: r1(R * 0.7), fill: C.n3 }, p);
			const G = g(p);
			shaded(
				G,
				"circle",
				{ cx: r1(x), cy: r1(y), r: r1(EARTH.r * R) },
				C.blue,
				C.blueD,
				R * 0.06,
				R * 0.06,
			);
			const Rr = rng(5);
			for (const [cx, cy, rr, n] of LANDS) blob(G, x + cx * k, y + cy * k, rr * k, n, Rr, C.mint);
			for (const [cx, cy, w] of CLOUDS)
				el(
					"rect",
					{
						x: r1(x + (cx - w / 2) * k),
						y: r1(y + (cy - 9) * k),
						width: r1(w * k),
						height: r1(18 * k),
						rx: r1(9 * k),
						fill: C.cream,
					},
					G,
				);
			const a = -2.2 + t * 0.25;
			satellite(
				p,
				r1(x + Math.cos(a) * R * 0.86),
				r1(y + Math.sin(a) * R * 0.5),
				R * 0.07,
				(a * 180) / Math.PI,
			);
		},
	},
	{
		id: "cell",
		name: { es: "Una célula", en: "A cell" },
		sky: "plasma",
		target: [0.08, -0.6],
		ring: 0.06,
		draw: (p, x, y, R, t) => {
			const f = (i: number) => Math.sin(t * 0.6 + i * 1.7) * R * 0.012;
			rbc(p, r1(x - 0.78 * R + f(1)), r1(y + 0.52 * R), r1(0.3 * R));
			rbc(p, r1(x + 0.8 * R), r1(y + 0.14 * R + f(2)), r1(0.22 * R));
			rbc(p, r1(x - 0.62 * R), r1(y - 0.58 * R + f(3)), r1(0.24 * R));
			rbc(p, r1(x + f(4)), r1(y + 0.05 * R), r1(0.44 * R));
			bacterium(p, r1(x + 0.58 * R), r1(y - 0.52 * R + f(5)), 0.5 * R, 0.15 * R, 204);
			el(
				"circle",
				{ cx: r1(x + 0.08 * R), cy: r1(y - 0.6 * R), r: r1(0.022 * R), fill: C.cream },
				p,
			);
		},
	},
	{
		id: "virus",
		name: { es: "Un virus", en: "A virus" },
		sky: "plasma",
		target: [0.22, -0.2],
		ring: 0.05,
		draw: (p, x, y, R, t) => {
			virusShape(p, r1(x), r1(y), 0.55 * R, 0.2 + t * 0.04);
		},
	},
];

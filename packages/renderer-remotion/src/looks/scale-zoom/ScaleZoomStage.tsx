import type { SceneContent, Storyboard } from "@frameflow/core/storyboard";
import { loadFont } from "@remotion/google-fonts/Jost";
import { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { formatValue, type Scene, scenesOf } from "../scenes";
import { STOPS, type Stop } from "./stops";
import { C, clipOf, el, g, r1, rng, setRoot } from "./vendor/flat.js";
import { type OrbiPose, orbi, orbiLens } from "./vendor/orbi.js";

// Estilo "Viaje de escala" (Scale Zoom Explainer): coreografía propia de Frameflow sobre los
// dibujos planos de flat-space-explainer de Lemo-Opuscar (vendor/, MIT). Un SVG que se rehace en
// cada fotograma y solo depende del segundo t (vista previa y MP4 coinciden):
//   · cada escena es una parada (galaxia → sistema solar → Tierra → célula → virus → …);
//   · antes de cambiar de escena, un anillo marca la siguiente parada, Orbi (la sonda cuyo ojo es
//     un zoom) la apunta con una línea de puntos y la cámara se zambulle por el anillo;
//   · en "de lo diminuto al cosmos" el viaje va al revés: la cámara se aleja;
//   · texto: titular que sube palabra a palabra; cifra: número grande que rueda hasta su valor;
//   · arriba, el recorrido con las paradas.
// Los subtítulos, las capas y la llamada a la acción van encima, como en el resto de estilos.

const jost = loadFont("normal", {
	weights: ["500", "600", "700"],
	subsets: ["latin", "latin-ext"],
});

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const eio = (k: number) => {
	const x = clamp(k);
	return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};
const eo = (k: number) => 1 - (1 - clamp(k)) ** 3;
/** Muelle: 0 antes de t0 y se asienta en 1 con un pequeño rebote. */
const spr = (t: number, t0: number, w = 16, d = 8) => {
	const x = t - t0;
	return x <= 0 ? 0 : 1 - Math.exp(-d * x) * (Math.cos(w * x) + (d / w) * Math.sin(w * x));
};
/** Oscilación que se apaga después de t0. */
const wob = (t: number, t0: number, w = 12, d = 5) => {
	const x = t - t0;
	return x <= 0 ? 0 : Math.exp(-d * x) * Math.sin(w * x);
};
const blink = (t: number, t0: number) =>
	eio(seg(t, t0, t0 + 0.07)) * (1 - eio(seg(t, t0 + 0.11, t0 + 0.22)));

/** Duración de la zambullida: empieza antes del corte y acaba poco después. */
const DIVE = { before: 0.55, after: 0.35 };
/** Tamaño de la parada siguiente dentro de su anillo (pequeña: así el anillo acaba cubriendo la pantalla). */
const INNER = 0.3;

type Journey = "in" | "out";
type Pt = [number, number];

const COPY = {
	es: { next: "PRÓXIMA PARADA", stop: "PARADA" },
	en: { next: "NEXT STOP", stop: "STOP" },
};

export const ScaleZoomStage = ({
	storyboard,
	options,
}: {
	storyboard: Storyboard;
	options: Record<string, string>;
}) => {
	const frame = useCurrentFrame();
	const { width: W, height: H, fps } = useVideoConfig();
	const svg = useRef<SVGSVGElement>(null);
	const scenes = useMemo(() => scenesOf(storyboard), [storyboard]);
	const journey: Journey = options.journey === "out" ? "out" : "in";
	const language = storyboard.language === "en" ? "en" : "es";

	useLayoutEffect(() => {
		if (!svg.current) return;
		drawFrame(svg.current, { t: frame / fps, W, H, scenes, journey, language });
	}, [frame, fps, W, H, scenes, journey, language]);

	return (
		<AbsoluteFill style={{ backgroundColor: C.night }}>
			<svg
				ref={svg}
				width={W}
				height={H}
				viewBox={`0 0 ${W} ${H}`}
				fontFamily={jost.fontFamily}
				style={{ width: "100%", height: "100%" }}
				aria-hidden="true"
				data-look="scale-zoom"
			/>
		</AbsoluteFill>
	);
};

type Layout = {
	portrait: boolean;
	/** Dónde se encuadra la parada y su tamaño (R en píxeles). */
	F: Pt;
	S: number;
	text: { x: number; y: number; w: number; size: number; label: number };
	orbi: { x: number; y: number; s: number };
	ribbon: { x0: number; x1: number; y: number };
};

function layoutFor(W: number, H: number): Layout {
	if (H > W)
		return {
			portrait: true,
			F: [0.5 * W, 0.28 * H],
			S: 0.4 * W,
			text: { x: 0.08 * W, y: 0.52 * H, w: 0.84 * W, size: 0.05 * H, label: 0.0155 * H },
			orbi: { x: 0.85 * W, y: 0.445 * H, s: 0.15 * W },
			ribbon: { x0: 0.14 * W, x1: 0.86 * W, y: 0.055 * H },
		};
	return {
		portrait: false,
		F: [0.67 * W, 0.47 * H],
		S: 0.36 * H,
		text: { x: 0.07 * W, y: 0.3 * H, w: 0.4 * W, size: 0.085 * H, label: 0.022 * H },
		orbi: { x: 0.905 * W, y: 0.75 * H, s: 0.19 * H },
		ribbon: { x0: 0.56 * W, x1: 0.93 * W, y: 0.09 * H },
	};
}

/** Parada de cada escena: hacia dentro empieza en la galaxia; hacia fuera termina en ella. */
const stopOf = (index: number, count: number, journey: Journey): Stop =>
	STOPS[(journey === "in" ? index : count - 1 - index) % STOPS.length] as Stop;

function drawFrame(
	root: SVGSVGElement,
	s: { t: number; W: number; H: number; scenes: Scene[]; journey: Journey; language: "es" | "en" },
) {
	const { t, W, H, scenes, journey, language } = s;
	root.replaceChildren();
	const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs") as SVGDefsElement;
	root.appendChild(defs);
	setRoot(root, defs);
	const L = layoutFor(W, H);
	el("rect", { x: 0, y: 0, width: W, height: H, fill: C.night });
	const n = Math.max(1, scenes.length);

	// ---- Escena actual y, si toca, la zambullida hacia la siguiente
	let index = scenes.findLastIndex((sc) => t >= sc.start);
	if (index < 0) index = 0;
	const scene = scenes[index];
	const boundary = scene && index < scenes.length - 1 ? scene.end : null;
	const prevBoundary = index > 0 ? (scenes[index - 1] as Scene).end : null;
	// u: avance de la zambullida (0 = encuadre de la escena de antes, 1 = la de después).
	let pair: { from: number; to: number; u: number } | null = null;
	if (boundary !== null && t >= boundary - DIVE.before)
		pair = { from: index, to: index + 1, u: seg(t, boundary - DIVE.before, boundary + DIVE.after) };
	else if (prevBoundary !== null && t < prevBoundary + DIVE.after)
		pair = {
			from: index - 1,
			to: index,
			u: seg(t, prevBoundary - DIVE.before, prevBoundary + DIVE.after),
		};

	// Siempre se dibuja una pareja "exterior → interior" con v: 0 = encuadra la exterior, 1 = la interior.
	let outer: Stop;
	let inner: Stop | null;
	let v: number;
	if (pair) {
		const a = stopOf(pair.from, n, journey);
		const b = stopOf(pair.to, n, journey);
		[outer, inner, v] = journey === "in" ? [a, b, pair.u] : [b, a, 1 - pair.u];
	} else {
		outer = stopOf(index, n, journey);
		inner = journey === "in" && index < n - 1 ? stopOf(index + 1, n, journey) : null;
		v = 0;
	}

	// Aviso de la próxima parada (solo hacia dentro): anillo + etiqueta, y Orbi dispara su línea.
	const aim =
		journey === "in" && boundary !== null && !pair
			? {
					show: seg(t, boundary - 1.6, boundary - 1.35),
					fire: seg(t, boundary - 1.25, boundary - 0.95),
				}
			: null;
	const intro = index === 0 && !pair ? spr(t, (scenes[0]?.start ?? 0) - 0.05, 9, 7) : 1;
	const world = drawPair(
		L,
		W,
		H,
		t,
		outer,
		inner,
		v,
		intro,
		aim?.show ?? (pair && journey === "in" ? 1 : 0),
	);

	if (aim && aim.show > 0 && inner)
		ringLabel(L, world.ring, COPY[language].next, inner.name[language], aim.show);

	// ---- Orbi
	const lensTarget = world.ring && (aim || pair) ? world.ring.c : L.F;
	drawOrbi(L, t, lensTarget, {
		fire: aim ? aim.fire : 0,
		ring: aim && aim.fire > 0 ? world.ring : null,
		boundary,
		prevBoundary,
		diving: pair ? Math.sin(Math.PI * pair.u) : 0,
		smileAt: scene?.content.type === "stat" ? scene.start + 1.35 : null,
	});

	// ---- Recorrido (arriba)
	ribbon(L, n, pair ? pair.from + eio(pair.u) : index, (i) => stopOf(i, n, journey));

	// ---- Texto o cifra de la escena
	if (scene && !(pair && pair.to === index && t < (prevBoundary ?? 0) + DIVE.after - 0.05)) {
		const tIn = scene.start + (index > 0 ? DIVE.after : 0.3);
		const out =
			boundary !== null ? eio(seg(t, boundary - DIVE.before - 0.3, boundary - DIVE.before)) : 0;
		const label = `${COPY[language].stop} ${String(index + 1).padStart(2, "0")} · ${stopOf(index, n, journey).name[language].toUpperCase()}`;
		if (scene.content.type === "stat") statBlock(L, t - tIn, out, scene.content, language, label);
		else if (scene.content.type === "kinetic-text")
			textBlock(L, t - tIn, out, scene.content.lines, label);
		else listBlock(L, t - tIn, out, scene.content, label);
	}
}

/** Dibuja la parada exterior y, dentro de su anillo, la interior. Devuelve el anillo en pantalla. */
function drawPair(
	L: Layout,
	W: number,
	H: number,
	t: number,
	outer: Stop,
	inner: Stop | null,
	v: number,
	intro: number,
	ringShow: number,
) {
	const ve = eio(v);
	const zMax = 1 / (outer.ring * INNER);
	const lnZ = ve * Math.log(zMax);
	const sc = L.S * Math.exp(lnZ) * lerp(0.82, 1, intro);
	const q = outer.target;
	const float = Math.sin(t * 0.8) * L.S * 0.012;
	const F: Pt = [L.F[0], L.F[1] + float];
	const glide = eio(seg(v, 0, 0.75));
	const ringC: Pt = [lerp(F[0] + q[0] * L.S, F[0], glide), lerp(F[1] + q[1] * L.S, F[1], glide)];
	const center: Pt = [ringC[0] - q[0] * sc, ringC[1] - q[1] * sc];
	const rs = outer.ring * sc;
	const diag = Math.hypot(W, H);
	const covered = rs > diag + Math.hypot(ringC[0] - W / 2, ringC[1] - H / 2);

	if (!covered) {
		sky(W, H, outer.sky, 11, Math.exp(0.22 * lnZ), F, clamp(intro * 1.5));
		const P = g(null);
		outer.draw(P, center[0], center[1], sc, t);
	}
	const ring = { c: ringC, r: rs };
	const showInner = inner && (v > 0 || (ringShow > 0 && rs > 18));
	if (inner && showInner) {
		const clip = clipOf("circle", { cx: r1(ringC[0]), cy: r1(ringC[1]), r: r1(Math.max(0.5, rs)) });
		const I = g(null, { "clip-path": clip });
		el("circle", { cx: r1(ringC[0]), cy: r1(ringC[1]), r: r1(rs), fill: C.night }, I);
		sky(W, H, inner.sky, 23, Math.exp(0.22 * (lnZ - Math.log(zMax))), ringC, 1, I);
		inner.draw(I, ringC[0], ringC[1], rs * INNER, t);
	}
	if (!covered && (ringShow > 0 || v > 0)) {
		const k = v > 0 ? 1 : eo(ringShow);
		el("circle", {
			cx: r1(ringC[0]),
			cy: r1(ringC[1]),
			r: r1(Math.max(1, rs * lerp(1.6, 1, k))),
			fill: "none",
			stroke: C.sun,
			"stroke-width": 4,
		});
		el("circle", {
			cx: r1(ringC[0]),
			cy: r1(ringC[1]),
			r: r1(Math.max(1, rs * lerp(1.6, 1, k) + 13)),
			fill: "none",
			stroke: C.sun,
			"stroke-width": 2.5,
			"stroke-dasharray": "3 9",
			"stroke-linecap": "round",
		});
	}
	return { ring };
}

/** Fondo: estrellas (espacio) o partículas (dentro del cuerpo), con paralaje según el zoom. */
function sky(
	W: number,
	H: number,
	kind: Stop["sky"],
	seed: number,
	m: number,
	F: Pt,
	alpha: number,
	parent: SVGElement | null = null,
) {
	if (alpha <= 0) return;
	const R = rng(seed);
	const count = Math.round((W * H) / 14000);
	const P = g(parent);
	for (let i = 0; i < count; i++) {
		const x = F[0] + (R() * 1.6 - 0.8) * W * m;
		const y = F[1] + (R() * 1.6 - 0.8) * H * m;
		const k = R();
		if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
		if (kind === "stars") {
			const r = (k < 0.7 ? 1.4 + R() * 1.4 : 2.6 + R() * 2) * Math.min(2, Math.sqrt(m));
			el(
				"circle",
				{
					cx: r1(x),
					cy: r1(y),
					r: r1(r * alpha),
					fill: k < 0.55 ? C.mist : k < 0.85 ? C.cream : C.sun,
				},
				P,
			);
		} else {
			const r = (2 + R() * 4) * Math.min(2.5, m);
			el("circle", { cx: r1(x), cy: r1(y), r: r1(r * alpha), fill: k < 0.75 ? C.n3 : C.mist }, P);
		}
	}
}

/** Etiqueta de la próxima parada, debajo del anillo, con su guía. */
function ringLabel(L: Layout, ring: { c: Pt; r: number }, head: string, name: string, k: number) {
	const size = L.portrait ? L.text.label * 1.75 : L.text.label * 1.6;
	const x = ring.c[0];
	const y = Math.min(
		ring.c[1] + ring.r + size * 3.4,
		L.portrait ? L.text.y - size * 1.2 : L.orbi.y,
	);
	const G = g(null, {
		"clip-path": clipOf("rect", {
			x: r1(x - 600),
			y: r1(y - size * 2.4),
			width: 1200,
			height: r1(size * 3.6 * eo(k)),
		}),
	});
	el("path", {
		d: `M${r1(x)},${r1(ring.c[1] + ring.r + 22)}L${r1(x)},${r1(y - size * 1.9)}`,
		stroke: C.sun,
		"stroke-width": 2.5,
		"stroke-linecap": "round",
	});
	label(G, x, y - size * 0.9, head, size * 0.58, C.sun, "middle", 3);
	label(G, x, y + size * 0.35, name, size, C.cream, "middle", 0, 600);
}

function label(
	p: SVGElement,
	x: number,
	y: number,
	str: string,
	size: number,
	fill: string,
	anchor: "start" | "middle" | "end",
	spacing = 0,
	weight = 600,
) {
	const tx = el(
		"text",
		{
			x: r1(x),
			y: r1(y),
			"font-size": r1(size),
			"font-weight": weight,
			fill,
			"letter-spacing": spacing,
			"text-anchor": anchor,
		},
		p,
	);
	tx.textContent = str;
	return tx;
}

/** Orbi en su esquina: flota, parpadea, mira la próxima parada y dispara la línea de puntos. */
function drawOrbi(
	L: Layout,
	t: number,
	lookAt: Pt,
	o: {
		fire: number;
		ring: { c: Pt; r: number } | null;
		boundary: number | null;
		prevBoundary: number | null;
		diving: number;
		smileAt: number | null;
	},
) {
	const { x: ox, y: oy, s } = L.orbi;
	const b = o.boundary ?? 1e9;
	const pb = o.prevBoundary ?? -1e9;
	const dx = lookAt[0] - ox;
	const dy = lookAt[1] - oy;
	const d = Math.hypot(dx, dy) || 1;
	const fireT = b - 1.25;
	const recoil =
		t >= fireT ? Math.exp(-6 * (t - fireT)) * (t < fireT + 0.05 ? (t - fireT) / 0.05 : 1) : 0;
	const smile = o.smileAt
		? eio(seg(t, o.smileAt, o.smileAt + 0.15)) * (1 - eio(seg(t, o.smileAt + 0.9, o.smileAt + 1.1)))
		: 0;
	const P: OrbiPose = {
		look: [(dx / d) * 0.85, (dy / d) * 0.85],
		lid: Math.max(blink(t, Math.floor(t / 3.7) * 3.7 + 1.9), 0),
		zoom:
			spr(t, b - 1.55, 17, 6.5) * (1 - eio(seg(t, b + 0.1, b + 0.5))) +
			0.35 * wob(t, pb + 0.3, 10, 4),
		smile,
		wide: o.diving * 0.8,
		sq: -0.08 * wob(t, fireT, 18, 7) - 0.06 * o.diving,
		rot: -6 - 3 * wob(t, fireT, 18, 7),
		tilt: -8 - 10 * wob(t, fireT, 18, 7) + 14 * o.diving,
		flame: 0.55 + 0.6 * o.diving + 0.3 * recoil,
		flick: t * 2 * Math.PI * 7,
		ant: -8 * Math.cos(2 * Math.PI * 0.45 * t + 0.5) + 18 * wob(t, fireT, 14, 5),
	};
	const x = ox + 3 * Math.sin(2 * Math.PI * 0.3 * t) - 10 * recoil * (dx / d);
	const y = oy + 6 * Math.sin(2 * Math.PI * 0.45 * t + 0.5) - 10 * recoil * (dy / d);
	if (o.ring && o.fire > 0) {
		const [lx, ly] = orbiLens(x, y, s, P);
		const [tx, ty] = o.ring.c;
		const len = Math.hypot(tx - lx, ty - ly);
		const end = (len - o.ring.r - 22) * eo(o.fire);
		const G = g(null);
		for (let k = s * 0.3; k <= end; k += 17)
			el(
				"circle",
				{
					cx: r1(lx + ((tx - lx) * k) / len),
					cy: r1(ly + ((ty - ly) * k) / len),
					r: 3.4,
					fill: C.sun,
				},
				G,
			);
	}
	orbi(g(null), x, y, s, P);
}

/** Recorrido: una pista con una marca por parada; la actual, con anillo. */
function ribbon(L: Layout, n: number, at: number, stopAt: (i: number) => Stop) {
	if (n < 2) return;
	const { x0, x1, y } = L.ribbon;
	const h = L.portrait ? 10 : 8;
	const G = g(null);
	el(
		"rect",
		{ x: r1(x0), y: r1(y - h / 2), width: r1(x1 - x0), height: h, rx: h / 2, fill: C.n3 },
		G,
	);
	const xOf = (i: number) => lerp(x0, x1, i / (n - 1));
	el(
		"rect",
		{
			x: r1(x0),
			y: r1(y - h / 2),
			width: r1(Math.max(h, xOf(clamp(at, 0, n - 1)) - x0)),
			height: h,
			rx: h / 2,
			fill: C.sun,
		},
		G,
	);
	for (let i = 0; i < n; i++) {
		const x = xOf(i);
		const passed = i <= at + 0.001;
		const kind = stopAt(i).id;
		const r = L.portrait ? 11 : 9;
		el("circle", { cx: r1(x), cy: r1(y), r: r1(r), fill: passed ? C.sun : C.n2 }, G);
		el(
			"circle",
			{ cx: r1(x), cy: r1(y), r: r1(r * 0.45), fill: passed ? C.cream : stopColor(kind) },
			G,
		);
	}
	const cur = xOf(clamp(at, 0, n - 1));
	const rr = L.portrait ? 24 : 20;
	el(
		"circle",
		{ cx: r1(cur), cy: r1(y), r: rr, fill: "none", stroke: C.sun, "stroke-width": 3 },
		G,
	);
}

const stopColor = (id: string) =>
	({ galaxy: C.blue, solar: C.sun, earth: C.mint, cell: C.coral, virus: C.cream })[id] ?? C.mist;

// ---- Texto

let measureCtx: CanvasRenderingContext2D | null = null;
function measure(str: string, size: number, weight = 700) {
	measureCtx ??= document.createElement("canvas").getContext("2d");
	if (!measureCtx) return str.length * size * 0.55;
	measureCtx.font = `${weight} ${size}px ${jost.fontFamily}`;
	return measureCtx.measureText(str).width;
}

/** Parte las líneas que no caben en el ancho (y reduce la letra si una palabra sola no cabe). */
function wrap(lines: readonly { text: string; emphasis?: boolean }[], w: number, base: number) {
	const out: { text: string; emphasis: boolean; size: number }[] = [];
	for (const line of lines) {
		const words = line.text.split(/\s+/).filter(Boolean);
		let cur = "";
		const flush = () => {
			if (!cur) return;
			const width = measure(cur, base);
			out.push({
				text: cur,
				emphasis: Boolean(line.emphasis),
				size: width > w ? (base * w) / width : base,
			});
			cur = "";
		};
		for (const word of words) {
			const next = cur ? `${cur} ${word}` : word;
			if (cur && measure(next, base) > w) {
				flush();
				cur = word;
			} else cur = next;
		}
		flush();
	}
	// Muchas líneas: todo un poco más pequeño para que quepa en su franja.
	const max = 5;
	if (out.length > max) for (const l of out) l.size *= max / out.length;
	return out;
}

function textBlock(
	L: Layout,
	k: number,
	out: number,
	lines: readonly { text: string; emphasis?: boolean }[],
	labelText: string,
) {
	if (k < 0) return;
	const { x, y, w, size, label: ls } = L.text;
	const G = g(null);
	const lk = eo(seg(k, 0, 0.3)) * (1 - out);
	if (lk > 0) {
		const lw = measure(labelText, ls, 600) + ls * 4;
		const C1 = g(G, {
			"clip-path": clipOf("rect", {
				x: r1(x - 8),
				y: r1(y - ls * 1.5),
				width: r1(lw * lk),
				height: r1(ls * 2.2),
			}),
		});
		label(C1, x, y, labelText, ls, C.mist, "start", 3);
	}
	let yy = y + ls * 1.4;
	wrap(lines, w, size).forEach((line, i) => {
		const lh = line.size * 1.12;
		const kk = spr(k, 0.12 + i * 0.12, 15, 7.5);
		const C2 = g(G, {
			"clip-path": clipOf("rect", {
				x: r1(x - 10),
				y: r1(yy),
				width: r1(w + 40),
				height: r1(lh * 1.08 * (1 - out)),
			}),
		});
		label(
			C2,
			x,
			yy + line.size * 0.92 + lh * (1 - kk) + lh * out,
			line.text,
			line.size,
			line.emphasis ? C.sun : C.cream,
			"start",
			-1,
			700,
		);
		yy += lh;
	});
}

function statBlock(
	L: Layout,
	k: number,
	out: number,
	c: { value: number; label: string; suffix?: string },
	language: string,
	stopLabel: string,
) {
	if (k < 0) return;
	const { x, y, w, size, label: ls } = L.text;
	const G = g(null);
	const lk = eo(seg(k, 0, 0.3)) * (1 - out);
	if (lk > 0) {
		const lw = measure(stopLabel, ls, 600) + ls * 4;
		const C1 = g(G, {
			"clip-path": clipOf("rect", {
				x: r1(x - 8),
				y: r1(y - ls * 1.5),
				width: r1(lw * lk),
				height: r1(ls * 2.2),
			}),
		});
		label(C1, x, y, stopLabel, ls, C.mist, "start", 3);
	}
	// Etiqueta de la cifra (en una o dos líneas) y el número grande rodando hasta su valor.
	const cap = wrap([{ text: c.label }], w, size * 0.42);
	let yy = y + ls * 1.6;
	cap.forEach((line, i) => {
		const kk = spr(k, 0.1 + i * 0.08, 15, 7.5);
		const lh = line.size * 1.2;
		const C2 = g(G, {
			"clip-path": clipOf("rect", {
				x: r1(x - 10),
				y: r1(yy),
				width: r1(w + 40),
				height: r1(lh * 1.1 * (1 - out)),
			}),
		});
		label(
			C2,
			x,
			yy + line.size + lh * (1 - kk) + lh * out,
			line.text,
			line.size,
			C.cream,
			"start",
			0,
			600,
		);
		yy += lh;
	});
	const decimals = Number.isInteger(c.value)
		? 0
		: Math.min(2, (String(c.value).split(".")[1] ?? "").length);
	const rolled = c.value * eo(seg(k, 0.35, 1.25));
	const shown = formatValue(Number(rolled.toFixed(decimals)), language);
	const final = formatValue(c.value, language);
	const suffix = c.suffix ? ` ${c.suffix}` : "";
	let big = size * (L.portrait ? 2.1 : 1.6);
	const total = measure(final, big) + measure(suffix, big * 0.4, 500);
	if (total > w) big *= w / total;
	const kk = spr(k, 0.3, 14, 7);
	const C3 = g(G, {
		"clip-path": clipOf("rect", {
			x: r1(x - 10),
			y: r1(yy + big * 0.08),
			width: r1(w + 60),
			height: r1(big * 1.12 * (1 - out)),
		}),
	});
	const by = yy + big * 1.0 + big * (1 - kk) + big * out;
	label(C3, x, by, shown, big, C.sun, "start", -2, 700);
	if (suffix)
		label(
			C3,
			x + measure(final, big) + big * 0.06,
			by,
			suffix.trim(),
			big * 0.4,
			C.mist,
			"start",
			0,
			500,
		);
}

type ListContent = Exclude<SceneContent, { type: "kinetic-text" } | { type: "stat" }>;

/** Tamaño de letra que cabe en el ancho (como mucho `size`). */
const fitSize = (text: string, size: number, maxW: number, weight = 700) => {
	const w = measure(text, size, weight);
	return w > maxW ? (size * maxW) / w : size;
};

/**
 * Pasos, línea de tiempo, comparación y gráfico en ilustración plana: círculos amarillos
 * numerados, una línea de puntos con hitos, dos tarjetas frente a frente o barras.
 */
function listBlock(L: Layout, k: number, out: number, c: ListContent, labelText: string) {
	if (k < 0) return;
	const { x, y, w, label: ls } = L.text;
	const G = g(null);
	const lk = eo(seg(k, 0, 0.3)) * (1 - out);
	if (lk > 0) {
		const lw = measure(labelText, ls, 600) + ls * 4;
		const C1 = g(G, {
			"clip-path": clipOf("rect", {
				x: r1(x - 8),
				y: r1(y - ls * 1.5),
				width: r1(lw * lk),
				height: r1(ls * 2.2),
			}),
		});
		label(C1, x, y, labelText, ls, C.mist, "start", 3);
	}
	let yy = y + ls * 1.6;
	const base = L.portrait ? L.text.size * 0.82 : L.text.size * 0.8;
	if (c.title) {
		const ts = fitSize(c.title, base, w);
		const kk = spr(k, 0.08, 15, 7.5);
		const CT = g(G, {
			"clip-path": clipOf("rect", {
				x: r1(x - 10),
				y: r1(yy),
				width: r1(w + 40),
				height: r1(ts * 1.25 * (1 - out)),
			}),
		});
		label(
			CT,
			x,
			yy + ts * 0.95 + ts * 1.2 * (1 - kk) + ts * 1.2 * out,
			c.title,
			ts,
			C.sun,
			"start",
			-1,
			700,
		);
		yy += ts * 1.4;
	}
	const at = (i: number) => spr(k, 0.3 + i * 0.4, 14, 7);
	const visible = (i: number) => Math.min(1, at(i)) * (1 - out);
	// Alto disponible: la franja de texto (27 % del alto en vertical, 50 % en horizontal).
	const height = L.portrait ? L.F[1] / 0.28 : L.F[1] / 0.47;
	const avail = height * (L.portrait ? 0.27 : 0.5) - (yy - y);
	const P = g(G);

	if (c.type === "steps" || c.type === "timeline") {
		const items =
			c.type === "steps"
				? c.items.map((t, i) => ({ mark: String(i + 1), text: t }))
				: c.events.map((e) => ({ mark: e.when, text: e.label }));
		const row = Math.min(base * 1.5, avail / items.length);
		const r = row * 0.3;
		if (c.type === "timeline") {
			const grow = eo(seg(k, 0.25, 0.3 + items.length * 0.4)) * (1 - out);
			for (let d = 0; d < (items.length - 1) * row * grow; d += 14)
				el("circle", { cx: r1(x + r), cy: r1(yy + row * 0.5 + d), r: 3, fill: C.mist }, P);
		}
		items.forEach((it, i) => {
			const v = visible(i);
			const cy = yy + row * 0.5;
			if (v > 0.01) {
				if (c.type === "steps") {
					el("circle", { cx: r1(x + r), cy: r1(cy), r: r1(r * v), fill: C.sun }, P);
					label(P, x + r, cy + r * 0.4, it.mark, r * 1.1 * v, C.night, "middle", 0, 700);
					const ts = fitSize(it.text, row * 0.42, w - r * 2 - 24);
					label(
						P,
						x + r * 2 + 24,
						cy + ts * 0.35 + (1 - v) * 30,
						it.text,
						ts,
						C.cream,
						"start",
						-0.5,
						700,
					);
				} else {
					el("circle", { cx: r1(x + r), cy: r1(cy), r: r1(r * 0.45 * v), fill: C.sun }, P);
					const tx = x + r * 2 + 18;
					label(P, tx, cy - row * 0.06 + (1 - v) * 20, it.mark, row * 0.28, C.sun, "start", 0, 700);
					const ts = fitSize(it.text, row * 0.3, w - (tx - x), 600);
					label(P, tx, cy + ts * 1.1 + (1 - v) * 20, it.text, ts, C.cream, "start", 0, 600);
				}
			}
			yy += row;
		});
	} else if (c.type === "compare") {
		const gap = base * 0.9;
		const cw = (w - gap) / 2;
		const ch = Math.min(avail, base * 3.4);
		c.items.forEach((it, i) => {
			const v = visible(i);
			if (v <= 0.01) return;
			const cx = x + i * (cw + gap);
			const dy = (1 - v) * 40;
			el(
				"rect",
				{
					x: r1(cx),
					y: r1(yy + dy),
					width: r1(cw),
					height: r1(ch),
					rx: r1(base * 0.4),
					fill: i === 0 ? C.n2 : C.n3,
				},
				P,
			);
			const ls2 = fitSize(it.label, base * 0.9, cw - 30);
			label(
				P,
				cx + cw / 2,
				yy + dy + ch * (it.detail ? 0.45 : 0.55),
				it.label,
				ls2,
				C.cream,
				"middle",
				-0.5,
				700,
			);
			if (it.detail) {
				const ds = fitSize(it.detail, base * 0.5, cw - 30, 600);
				label(P, cx + cw / 2, yy + dy + ch * 0.72, it.detail, ds, C.sun, "middle", 0, 600);
			}
		});
		const vs = Math.min(1, at(0.6)) * (1 - out);
		if (vs > 0.01) {
			const pw = base * 1.4 * vs;
			const ph = base * 0.8 * vs;
			el(
				"rect",
				{
					x: r1(x + w / 2 - pw / 2),
					y: r1(yy + ch / 2 - ph / 2),
					width: r1(pw),
					height: r1(ph),
					rx: r1(ph / 2),
					fill: C.sun,
				},
				P,
			);
			label(P, x + w / 2, yy + ch / 2 + ph * 0.25, "VS", ph * 0.6, C.night, "middle", 1, 700);
		}
	} else {
		const max = Math.max(...c.bars.map((b) => b.value), 1e-9);
		const row = Math.min(base * 1.55, avail / c.bars.length);
		c.bars.forEach((bar, i) => {
			const v = visible(i);
			if (v > 0.01) {
				const grow = eo(seg(k, 0.3 + i * 0.4, 1.1 + i * 0.4)) * (1 - out);
				label(P, x, yy + row * 0.32, bar.label, row * 0.3, C.cream, "start", 0, 600);
				const bh = row * 0.34;
				const bw = Math.max(bh, (bar.value / max) * w * 0.72 * grow);
				const top = bar.value === max;
				el(
					"rect",
					{
						x: r1(x),
						y: r1(yy + row * 0.44),
						width: r1(bw),
						height: r1(bh),
						rx: r1(bh / 2),
						fill: top ? C.sun : C.blue,
					},
					P,
				);
				const shown = `${(bar.value * grow).toLocaleString("es-ES", { maximumFractionDigits: bar.value < 10 ? 1 : 0 })}${c.suffix ?? ""}`;
				label(
					P,
					x + bw + 14,
					yy + row * 0.44 + bh * 0.82,
					shown,
					bh * 0.95,
					top ? C.sun : C.mist,
					"start",
					0,
					700,
				);
			}
			yy += row;
		});
	}
}

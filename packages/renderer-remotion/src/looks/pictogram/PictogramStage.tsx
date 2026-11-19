import type { Storyboard } from "@frameflow/core/storyboard";
import { loadFont as loadDMMono } from "@remotion/google-fonts/DMMono";
import { loadFont as loadInterTight } from "@remotion/google-fonts/InterTight";
import { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { isListContent } from "../hologram/listPanels";
import { formatValue, type Scene, scenesOf } from "../scenes";
import { drawListCard } from "./listScenes";
import { composite, TRANSITIONS } from "./transitions";
import "./vendor/engine.js";
import type { Palette, PaletteKey, PictogramEngine } from "./vendor/engine.js";

// Estilo "Pictogramas" (Pictogram Motion): coreografía propia de Frameflow sobre el motor de
// pictogram-motion de Lemo-Opuscar (vendor/engine.js, MIT). Un canvas que se redibuja en cada
// fotograma y solo depende del segundo t:
//   · fondo: una trama de figuras geométricas planas cuyas filas se deslizan en sentidos opuestos;
//   · un gran disco con un pictograma animado (sol, nube con lluvia, rayo, paraguas, luna, llave,
//     huellas) en las escenas de texto, o con la cifra en las de cifra;
//   · titular en letra muy gruesa que sube enmascarado línea a línea;
//   · cada escena con su color (o uno fijo) y transiciones de rejilla entre escenas.
// Los subtítulos, las capas y la llamada a la acción van encima, como en el resto de estilos.

const inter = loadInterTight("normal", {
	weights: ["700", "900"],
	subsets: ["latin", "latin-ext"],
});
const mono = loadDMMono("normal", { weights: ["500"], subsets: ["latin", "latin-ext"] });

const G: PictogramEngine = window.G;
G.F.en = (w, px) => `${w} ${px}px "${inter.fontFamily}"`;
G.F.mono = (px, w = 500) => `${w} ${px}px "${mono.fontFamily}"`;
// Motivos de la trama para cualquier tema: los geométricos y señales del original, sin los de
// lluvia ni el paraguas (esos eran de su historia).
G.MOTIFS.frameflow = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 13, 17, 19, 20, 15];

const CYCLE: readonly PaletteKey[] = ["teal", "navy", "coral", "ink", "sky", "yellow"];
const PICTOS = ["sun", "cloud", "umbrella", "bolt", "key", "moon", "foot"] as const;
type Picto = (typeof PICTOS)[number];

/** Duración de la transición: empieza justo antes del corte y acaba poco después. */
const TA = 0.12;
const TB = 0.3;

const COPY = { es: "ESCENA", en: "SCENE" };

export const PictogramStage = ({
	storyboard,
	options,
}: {
	storyboard: Storyboard;
	options: Record<string, string>;
}) => {
	const frame = useCurrentFrame();
	const { width: W, height: H, fps } = useVideoConfig();
	const canvas = useRef<HTMLCanvasElement>(null);
	const scenes = useMemo(() => scenesOf(storyboard), [storyboard]);
	const buffers = useMemo(() => [G.canvas(W, H), G.canvas(W, H)] as const, [W, H]);
	const color = options.color ?? "cycle";
	const language = storyboard.language === "en" ? "en" : "es";

	useLayoutEffect(() => {
		const ctx = canvas.current?.getContext("2d");
		if (!ctx) return;
		drawFrame(ctx, {
			t: frame / fps,
			W,
			H,
			scenes,
			color,
			title: storyboard.title,
			language,
			buffers,
		});
	}, [frame, fps, W, H, scenes, color, storyboard.title, language, buffers]);

	return (
		<AbsoluteFill style={{ backgroundColor: G.PAL.teal.t[1] }}>
			<canvas
				ref={canvas}
				width={W}
				height={H}
				style={{ width: "100%", height: "100%" }}
				data-look="pictogram"
			/>
		</AbsoluteFill>
	);
};

type Ctx = CanvasRenderingContext2D;
type FrameState = {
	t: number;
	W: number;
	H: number;
	scenes: Scene[];
	color: string;
	title: string;
	language: "es" | "en";
	buffers: readonly [HTMLCanvasElement, HTMLCanvasElement];
};

const paletteOf = (index: number, color: string): Palette => {
	const key = (CYCLE as readonly string[]).includes(color)
		? (color as PaletteKey)
		: (CYCLE[index % CYCLE.length] as PaletteKey);
	return G.PAL[key];
};

/** Color de acento sobre cada paleta: el amarillo de señal, salvo donde no contrasta. */
const accentOf = (P: Palette) =>
	P.key === "yellow" ? G.PAL.navy.t[1] : P.key === "sky" ? G.PAL.coral.t[1] : G.PAL.yellow.t[2];

function drawFrame(ctx: Ctx, s: FrameState) {
	const { t, W, H, scenes } = s;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	let i = scenes.findLastIndex((sc) => t >= sc.start);
	if (i < 0) i = 0;
	const cur = scenes[i];
	const next = scenes[i + 1];
	// Transición alrededor de cada corte entre escenas.
	let tr: { a: number; b: number; at: number } | null = null;
	if (cur && next && t >= cur.end - TA) tr = { a: i, b: i + 1, at: cur.end };
	else if (i > 0 && cur && t < cur.start + TB) tr = { a: i - 1, b: i, at: cur.start };
	if (tr) {
		const [A, B] = s.buffers;
		const ca = A.getContext("2d") as Ctx;
		const cb = B.getContext("2d") as Ctx;
		drawScene(ca, s, tr.a, t);
		drawScene(cb, s, tr.b, Math.max(t, tr.at));
		const p = G.clamp((t - (tr.at - TA)) / (TA + TB));
		composite(G, ctx, TRANSITIONS[tr.a % TRANSITIONS.length] ?? "rows", p, A, B);
	} else drawScene(ctx, s, i, t);
	hud(ctx, s, i, W, H);
}

/** Una escena completa (fondo, disco, texto) en el segundo t. */
function drawScene(ctx: Ctx, s: FrameState, index: number, t: number) {
	const { W, H } = s;
	const sc = s.scenes[index];
	const P = paletteOf(index, s.color);
	const u = Math.min(W, H) / 1080;
	const portrait = H > W;
	const lt = sc ? t - sc.start : t;
	ctx.save();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.fillStyle = P.t[1];
	ctx.fillRect(0, 0, W, H);

	// Trama: filas que se deslizan en sentidos opuestos (en vertical, dos tramas apiladas).
	const drift = (j: number) => (j % 2 ? 1 : -1) * t * 26 + Math.sin(j * 1.7 + index) * 22;
	const tiles = Math.ceil(H / G.H);
	for (let k = 0; k < tiles; k++) {
		const pat = G.pattern(P.key as PaletteKey, 7 + index * 3 + k, {
			set: "frameflow",
			density: 0.5,
		});
		ctx.save();
		ctx.translate(0, k * G.H);
		G.drawPattern(ctx, pat, (j) => drift(j + k * 6));
		ctx.restore();
	}

	// Disco con el pictograma o la cifra.
	const disc = portrait
		? { x: 0.5 * W, y: 0.27 * H, r: 0.34 * W }
		: { x: 0.72 * W, y: 0.5 * H, r: 0.37 * H };
	const pop = G.E.oBack(G.inv(0, 0.45, lt));
	// Las escenas de pasos, línea de tiempo, comparación o gráfico se dibujan encima (en placa):
	// aquí solo queda la trama de fondo.
	const own = sc?.content.type === "stat" || sc?.content.type === "kinetic-text";
	if (own) stageDisc(ctx, disc.x, disc.y, disc.r * (0.92 + 0.08 * pop), P.t[0], lt);
	const accent = accentOf(P);
	const text = portrait
		? { x: 0.08 * W, y: 0.55 * H, w: 0.84 * W, px: 118 * u }
		: { x: 0.07 * W, y: 0.36 * H, w: 0.42 * W, px: 124 * u };
	const meta = `${COPY[s.language]} ${String(index + 1).padStart(2, "0")} / ${String(s.scenes.length).padStart(2, "0")}`;

	if (sc?.content.type === "stat") {
		const c = sc.content;
		statDisc(ctx, disc, c, s.language, lt, P, accent, u);
		titleLines(ctx, [{ text: c.label }], text, text.px * 0.55, lt, P.fg, accent, meta, u);
	} else if (sc?.content.type === "kinetic-text") {
		const picto = PICTOS[index % PICTOS.length] as Picto;
		ctx.save();
		ctx.translate(disc.x, disc.y);
		ctx.scale(pop, pop);
		drawPicto(ctx, picto, 0, 0, disc.r, lt, P.fg, accent);
		ctx.restore();
		titleLines(ctx, sc.content.lines, text, text.px, lt, P.fg, accent, meta, u);
	} else if (sc && isListContent(sc.content)) {
		drawListCard(G, ctx, sc.content, { W, H, lt, P, accent, meta, portrait });
	}
	ctx.restore();
}

/** Disco de escenario con un barrido de luz (como stageDisc del original). */
function stageDisc(ctx: Ctx, x: number, y: number, r: number, col: string, lt: number) {
	G.disc(ctx, x, y, r, col);
	ctx.save();
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.clip();
	const sx = x - r * 1.6 + G.E.o3(G.inv(0.1, 2.6, lt)) * r * 3.2;
	const g = ctx.createLinearGradient(sx - r * 0.5, y - r, sx + r * 0.5, y + r);
	g.addColorStop(0, "rgba(255,255,255,0)");
	g.addColorStop(0.5, "rgba(255,255,255,0.09)");
	g.addColorStop(1, "rgba(255,255,255,0)");
	ctx.fillStyle = g;
	ctx.fillRect(x - r, y - r, r * 2, r * 2);
	ctx.restore();
}

/** Pictograma animado centrado en (x, y) dentro de un disco de radio r. */
function drawPicto(
	ctx: Ctx,
	kind: Picto,
	x: number,
	y: number,
	r: number,
	lt: number,
	fg: string,
	accent: string,
) {
	const beat = (lt % 0.5) / 0.5;
	const bump = 1 + 0.04 * Math.exp(-beat * 6);
	if (kind === "sun") G.sunIcon(ctx, x, y, r * 0.3 * bump, accent, lt * 0.5);
	else if (kind === "moon") G.moon(ctx, x - r * 0.05, y, r * 0.42 * bump, fg);
	else if (kind === "cloud" || kind === "bolt") {
		G.cloud(ctx, x, y + r * 0.08, r * 0.55, fg);
		if (kind === "cloud")
			for (let k = 0; k < 3; k++) {
				const ph = (lt * 1.1 + k / 3) % 1;
				G.drop(ctx, x + (k - 1) * r * 0.28, y + r * 0.22 + ph * r * 0.5, r * 0.05, accent);
			}
		else if (lt % 1 < 0.55) G.bolt(ctx, x - r * 0.02, y + r * 0.02, r * 0.55, accent);
	} else if (kind === "umbrella") {
		const open = G.E.oBack(G.inv(0.15, 0.7, lt));
		G.umbrella(
			ctx,
			x,
			y + r * 0.08,
			r * 0.55,
			open,
			Math.sin(lt * 2) * 0.06,
			accent,
			G.mix(accent, "#000000", 0.18),
			fg,
		);
	} else if (kind === "key") {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(Math.sin(lt * 1.6) * 0.12);
		G.item(ctx, 1, 0, 0, r * 1.4, fg);
		ctx.restore();
	} else {
		// Huellas que avanzan una por tiempo (cada medio segundo).
		for (let k = 0; k < 4; k++) {
			if (lt < 0.2 + k * 0.5) break;
			G.foot(
				ctx,
				x + (k % 2 ? r * 0.17 : -r * 0.17),
				y + r * 0.48 - k * r * 0.32,
				r * 0.13,
				0,
				k === 3 ? accent : fg,
				k % 2 ? -1 : 1,
			);
		}
	}
}

/** Cifra dentro del disco: número que rueda hasta su valor, unidad debajo y un aro que se llena. */
function statDisc(
	ctx: Ctx,
	d: { x: number; y: number; r: number },
	c: { value: number; label: string; suffix?: string },
	language: string,
	lt: number,
	P: Palette,
	accent: string,
	u: number,
) {
	const k = G.E.o3(G.inv(0.2, 1.2, lt));
	const decimals = Number.isInteger(c.value)
		? 0
		: Math.min(2, (String(c.value).split(".")[1] ?? "").length);
	const shown = formatValue(Number((c.value * k).toFixed(decimals)), language);
	const final = formatValue(c.value, language);
	ctx.save();
	let px = d.r * 0.62;
	ctx.font = G.F.en(900, px);
	const w = ctx.measureText(final).width;
	if (w > d.r * 1.55) px *= (d.r * 1.55) / w;
	G.maskText(ctx, shown, d.x, d.y + px * 0.32, G.F.en(900, px), P.fg, G.inv(0.15, 0.6, lt), {
		align: "center",
		ls: `${-0.02 * px}px`,
	});
	if (c.suffix)
		G.maskText(
			ctx,
			c.suffix.trim().toUpperCase(),
			d.x,
			d.y + px * 0.32 + 56 * u,
			G.F.mono(30 * u),
			accent,
			G.inv(0.3, 0.75, lt),
			{
				align: "center",
				ls: "4px",
			},
		);
	// Aro de avance alrededor del disco.
	ctx.strokeStyle = accent;
	ctx.lineWidth = 12 * u;
	ctx.lineCap = "round";
	ctx.beginPath();
	ctx.arc(d.x, d.y, d.r + 22 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
	if (k > 0.001) ctx.stroke();
	ctx.restore();
}

/** Bloque de texto: línea "ESCENA 02 / 05" que se teclea y titular que sube enmascarado. */
function titleLines(
	ctx: Ctx,
	lines: readonly { text: string; emphasis?: boolean }[],
	box: { x: number; y: number; w: number },
	base: number,
	lt: number,
	fg: string,
	accent: string,
	meta: string,
	u: number,
) {
	ctx.save();
	const wrapped = wrap(ctx, lines, box.w, base);
	const px = wrapped.size;
	const lh = px * 0.95;
	G.typeText(
		ctx,
		meta,
		box.x + 4,
		box.y - px * 0.85 - 30 * u,
		G.F.mono(24 * u),
		G.rgba(fg, 0.8),
		G.inv(0.05, 0.4, lt),
		{
			ls: "3px",
		},
	);
	wrapped.lines.forEach((line, i) => {
		G.maskText(
			ctx,
			line.text,
			box.x - px * 0.03,
			box.y + i * lh,
			G.F.en(900, px),
			line.emphasis ? accent : fg,
			G.inv(0.1 + 0.08 * i, 0.6 + 0.08 * i, lt),
			{
				ls: `${-0.008 * px}px`,
			},
		);
	});
	ctx.restore();
}

/** Parte las líneas que no caben y reduce la letra hasta que el bloque quepa (máx. 5 líneas). */
function wrap(
	ctx: Ctx,
	lines: readonly { text: string; emphasis?: boolean }[],
	w: number,
	base: number,
) {
	let px = base;
	for (let attempt = 0; attempt < 8; attempt++) {
		ctx.font = G.F.en(900, px);
		ctx.letterSpacing = `${-0.008 * px}px`;
		const out: { text: string; emphasis: boolean }[] = [];
		let fits = true;
		for (const line of lines) {
			let cur = "";
			for (const word of line.text.split(/\s+/).filter(Boolean)) {
				const next = cur ? `${cur} ${word}` : word;
				if (ctx.measureText(next).width > w) {
					if (cur) out.push({ text: cur, emphasis: Boolean(line.emphasis) });
					cur = word;
					if (ctx.measureText(word).width > w) fits = false;
				} else cur = next;
			}
			if (cur) out.push({ text: cur, emphasis: Boolean(line.emphasis) });
		}
		if (fits && out.length <= 5) return { lines: out, size: px };
		px *= 0.85;
	}
	return { lines: lines.map((l) => ({ text: l.text, emphasis: Boolean(l.emphasis) })), size: px };
}

/** Marco: título del video arriba a la izquierda y una marca por escena abajo. */
function hud(ctx: Ctx, s: FrameState, index: number, W: number, H: number) {
	const P = paletteOf(index, s.color);
	const u = Math.min(W, H) / 1080;
	const m = 64 * u;
	ctx.save();
	ctx.font = G.F.mono(18 * u);
	ctx.letterSpacing = "3px";
	ctx.fillStyle = G.rgba(P.fg, 0.8);
	ctx.textAlign = "left";
	const title = s.title.toUpperCase();
	ctx.fillText(title.length > 34 ? `${title.slice(0, 33)}…` : title, m, m + 6 * u);
	const n = s.scenes.length;
	if (n > 1) {
		const y = H - 58 * u;
		for (let k = 0; k < n; k++) {
			const x = G.lerp(m, W - m, k / (n - 1));
			const now = k === index;
			ctx.fillStyle = G.rgba(P.fg, now ? 1 : k < index ? 0.75 : 0.28);
			ctx.fillRect(
				Math.round(x) - (now ? 2 : 1),
				y - (now ? 14 : 6) * u,
				now ? 4 : 2,
				(now ? 20 : 12) * u,
			);
		}
	}
	ctx.restore();
}

import type { SceneContent } from "@frameflow/core/storyboard";
import type { Palette, PictogramEngine } from "./vendor/engine.js";

// Pictogramas: pasos, línea de tiempo, comparación y gráfico sobre una tarjeta del tono oscuro de
// la paleta, con las piezas del motor de pictogram-motion (discos, texto enmascarado, barras
// redondeadas). Escrito para Frameflow.

type ListContent = Exclude<SceneContent, { type: "kinetic-text" } | { type: "stat" }>;
type Ctx = CanvasRenderingContext2D;

export function drawListCard(
	G: PictogramEngine,
	ctx: Ctx,
	c: ListContent,
	o: {
		W: number;
		H: number;
		lt: number;
		P: Palette;
		accent: string;
		meta: string;
		portrait: boolean;
	},
) {
	const { W, H, lt, P, accent, portrait } = o;
	const u = Math.min(W, H) / 1080;
	const { E, inv } = G;
	// Tarjeta del alto justo para su contenido, centrada en la franja de la escena.
	const maxCard = portrait
		? { x: 0.07 * W, y: 0.15 * H, w: 0.86 * W, h: 0.58 * H }
		: { x: 0.08 * W, y: 0.12 * H, w: 0.84 * W, h: 0.7 * H };
	const pad = 56 * u;
	const x = maxCard.x + pad;
	const w = maxCard.w - pad * 2;
	const titleSize = c.title ? fit(G, ctx, c.title, 900, (portrait ? 70 : 64) * u, w) : 0;
	const headerH = 24 * u + 30 * u + (c.title ? titleSize + 24 * u : 0);
	const n =
		c.type === "steps"
			? c.items.length
			: c.type === "timeline"
				? c.events.length
				: c.type === "chart"
					? c.bars.length
					: 0;
	const rowPref = c.type === "chart" ? (portrait ? 140 : 110) * u : (portrait ? 150 : 120) * u;
	const compareR = Math.min((w - 40 * u) / 4, (portrait ? 220 : 200) * u);
	const listH = c.type === "compare" ? compareR * 2.3 : n * rowPref;
	const h = Math.min(maxCard.h, pad * 2 + headerH + listH);
	const center = portrait ? 0.44 * H : 0.47 * H;
	const card = { x: maxCard.x, y: Math.max(maxCard.y, center - h / 2), w: maxCard.w, h };
	const reveal = E.oExp(inv(0, 0.35, lt));
	G.rrect(ctx, card.x, card.y + (1 - reveal) * 40 * u, card.w, card.h, 48 * u, P.t[0]);
	if (reveal < 0.02) return;
	let y = card.y + pad + 24 * u;
	G.typeText(ctx, o.meta, x, y, G.F.mono(22 * u), G.rgba(P.fg, 0.75), inv(0.05, 0.4, lt), {
		ls: "3px",
	});
	y += 30 * u;
	if (c.title) {
		y += titleSize;
		G.maskText(ctx, c.title, x, y, G.F.en(900, titleSize), P.fg, inv(0.08, 0.5, lt), {
			ls: `${-0.008 * titleSize}px`,
		});
		y += 24 * u;
	}
	const at = (i: number) => inv(0.3 + i * 0.4, 0.75 + i * 0.4, lt);
	const bottom = card.y + card.h - pad;

	if (c.type === "steps" || c.type === "timeline") {
		const items =
			c.type === "steps"
				? c.items.map((t, i) => ({ mark: String(i + 1), text: t }))
				: c.events.map((e) => ({ mark: e.when, text: e.label }));
		const row = Math.min(rowPref, (bottom - y) / items.length);
		const r = row * 0.32;
		if (c.type === "timeline") {
			const grow = E.o3(inv(0.25, 0.3 + items.length * 0.4, lt));
			G.rrect(
				ctx,
				x + r - 4 * u,
				y + row * 0.5,
				8 * u,
				Math.max(1, (items.length - 1) * row * grow),
				4 * u,
				G.rgba(P.fg, 0.35),
			);
		}
		items.forEach((it, i) => {
			const k = at(i);
			const cy = y + row * 0.5;
			if (k > 0) {
				const pop = E.oBack(Math.min(1, k * 1.4));
				if (c.type === "steps") {
					G.disc(ctx, x + r, cy, r * pop, accent);
					ctx.save();
					ctx.font = G.F.en(900, r * 1.15);
					ctx.fillStyle = P.t[0];
					ctx.textAlign = "center";
					ctx.textBaseline = "middle";
					ctx.globalAlpha = Math.min(1, k * 2);
					ctx.fillText(it.mark, x + r, cy + r * 0.06);
					ctx.restore();
					const ts = fit(G, ctx, it.text, 800, row * 0.42, w - r * 2 - 32 * u);
					G.maskText(ctx, it.text, x + r * 2 + 32 * u, cy + ts * 0.35, G.F.en(800, ts), P.fg, k);
				} else {
					G.disc(ctx, x + r, cy, r * 0.42 * pop, accent);
					const tx = x + r * 2 + 28 * u;
					G.maskText(ctx, it.mark, tx, cy - row * 0.04, G.F.mono(row * 0.24, 500), accent, k, {
						ls: "2px",
					});
					const ts = fit(G, ctx, it.text, 800, row * 0.32, w - (tx - x));
					G.maskText(
						ctx,
						it.text,
						tx,
						cy + ts * 1.05,
						G.F.en(800, ts),
						P.fg,
						inv(0.35 + i * 0.4, 0.85 + i * 0.4, lt),
					);
				}
			}
			y += row;
		});
	} else if (c.type === "compare") {
		const gap = 40 * u;
		const r = Math.min(compareR, (bottom - y) / 2.2);
		const cy = y + (bottom - y) / 2;
		c.items.forEach((it, i) => {
			const k = at(i * 1.2);
			if (k <= 0) return;
			const cx = i === 0 ? x + w / 2 - gap / 2 - r : x + w / 2 + gap / 2 + r;
			G.disc(ctx, cx, cy, r * E.oBack(Math.min(1, k * 1.3)), i === 0 ? P.t[1] : P.t[2]);
			const ls = fit(G, ctx, it.label, 900, r * 0.42, r * 1.6);
			G.maskText(ctx, it.label, cx, cy + (it.detail ? 0 : ls * 0.35), G.F.en(900, ls), P.fg, k, {
				align: "center",
			});
			if (it.detail) {
				const ds = fit(G, ctx, it.detail, 500, r * 0.2, r * 1.6, true);
				G.maskText(
					ctx,
					it.detail,
					cx,
					cy + ls * 0.9,
					G.F.mono(ds),
					accent,
					inv(0.5 + i * 0.5, 1 + i * 0.5, lt),
					{ align: "center" },
				);
			}
		});
		const vs = E.oBack(inv(0.7, 1.1, lt));
		if (vs > 0) {
			const vw = 120 * u * vs;
			const vh = 70 * u * vs;
			G.rrect(ctx, x + w / 2 - vw / 2, cy - vh / 2, vw, vh, vh / 2, accent);
			ctx.save();
			ctx.font = G.F.en(900, 40 * u * vs);
			ctx.fillStyle = P.t[0];
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText("VS", x + w / 2, cy + 2 * u);
			ctx.restore();
		}
	} else {
		const max = Math.max(...c.bars.map((b) => b.value), 1e-9);
		const row = Math.min(rowPref, (bottom - y) / c.bars.length);
		c.bars.forEach((bar, i) => {
			const k = E.o3(at(i));
			if (k > 0) {
				G.typeText(
					ctx,
					bar.label.toUpperCase(),
					x,
					y + row * 0.3,
					G.F.mono(row * 0.2),
					G.rgba(P.fg, 0.85),
					Math.min(1, k * 2),
					{ ls: "2px" },
				);
				const bh = row * 0.36;
				const full = w * 0.74;
				const bw = Math.max(bh, (bar.value / max) * full * k);
				const top = bar.value === max;
				G.rrect(ctx, x, y + row * 0.42, bw, bh, bh / 2, top ? accent : P.t[3]);
				const v = bar.value * k;
				const label = `${v.toLocaleString("es-ES", { maximumFractionDigits: bar.value < 10 ? 1 : 0 })}${c.suffix ?? ""}`;
				ctx.save();
				ctx.font = G.F.en(900, bh * 0.95);
				ctx.fillStyle = top ? accent : P.fg;
				ctx.textBaseline = "middle";
				ctx.fillText(label, x + bw + 20 * u, y + row * 0.42 + bh / 2 + 2 * u);
				ctx.restore();
			}
			y += row;
		});
	}
}

/** Tamaño de letra para que el texto quepa en el ancho (como mucho `size`). */
function fit(
	G: PictogramEngine,
	ctx: Ctx,
	text: string,
	weight: number,
	size: number,
	maxW: number,
	mono = false,
) {
	ctx.save();
	ctx.font = mono ? G.F.mono(size, weight) : G.F.en(weight, size);
	const w = ctx.measureText(text).width;
	ctx.restore();
	return w > maxW ? (size * maxW) / w : size;
}

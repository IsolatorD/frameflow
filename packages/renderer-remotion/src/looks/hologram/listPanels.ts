import type { SceneContent } from "@frameflow/core/storyboard";
import * as U from "./vendor/hud.js";

// Holograma: pasos, línea de tiempo, comparación y gráfico como paneles de consola (placa
// translúcida, líneas que se "decodifican" una tras otra, barras de neón). Escrito para
// Frameflow con la capa de interfaz de hologram-hud (vendor/hud.js, MIT).

export type ListContent = Exclude<SceneContent, { type: "kinetic-text" } | { type: "stat" }>;

/** ¿Es una escena con varios elementos (pasos, línea de tiempo, comparación o gráfico)? */
export const isListContent = (c: SceneContent): c is ListContent =>
	c.type !== "kinetic-text" && c.type !== "stat";
type Box = {
	x: number;
	y: number;
	w: number;
	k: number;
	out: number;
	frame: number;
	size: number;
	index: number;
};

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const eo = (k: number) => 1 - (1 - k) ** 3;
const STAGGER = 0.3;

const KIND: Record<ListContent["type"], string> = {
	steps: "SEQ",
	timeline: "TIME",
	compare: "CMP",
	chart: "DATA",
};

/** Placa con cabecera "SEQ 03 · TÍTULO" y su línea superior; devuelve dónde empieza el contenido. */
function frame(ctx: CanvasRenderingContext2D, T: U.HudTheme, c: ListContent, o: Box, h: number) {
	const reveal = seg(o.k, 0.05, 0.4);
	U.plate(ctx, T, o.x - 22, o.y - 20, (o.w + 44) * eo(reveal), h + 24, o.out * clamp(reveal * 2));
	ctx.globalCompositeOperation = "lighter";
	ctx.strokeStyle = T.line(0.9 * o.out);
	ctx.lineWidth = 1.6;
	ctx.beginPath();
	ctx.moveTo(o.x, o.y);
	ctx.lineTo(o.x + o.w * eo(reveal), o.y);
	ctx.stroke();
	ctx.font = `20px ${U.FONT.mono}`;
	ctx.fillStyle = T.dim(0.95 * o.out);
	ctx.textAlign = "left";
	ctx.textBaseline = "alphabetic";
	const head = `${KIND[c.type]} ${String(o.index + 1).padStart(2, "0")}${c.title ? ` · ${c.title.toUpperCase()}` : ""}`;
	ctx.fillText(U.rollText(head, seg(o.k, 0.1, 0.5), o.frame, 3), o.x, o.y + 32);
	return o.y + 56;
}

const rowsOf = (c: ListContent) =>
	c.type === "steps"
		? c.items.length
		: c.type === "timeline"
			? c.events.length
			: c.type === "chart"
				? c.bars.length
				: 1;

export function listPanel(ctx: CanvasRenderingContext2D, T: U.HudTheme, c: ListContent, o: Box) {
	if (o.out <= 0 || o.k < 0) return;
	ctx.save();
	const n = rowsOf(c);
	const row = c.type === "compare" ? o.size * 3 : c.type === "chart" ? o.size * 1.45 : o.size * 1.3;
	const h = 72 + row * n;
	let y = frame(ctx, T, c, o, h);
	const at = (i: number) => seg(o.k, 0.35 + i * STAGGER, 0.8 + i * STAGGER);

	if (c.type === "steps" || c.type === "timeline") {
		const items =
			c.type === "steps"
				? c.items.map((t, i) => ({ mark: String(i + 1).padStart(2, "0"), text: t }))
				: c.events.map((e) => ({ mark: e.when, text: e.label }));
		const markW = c.type === "steps" ? o.size * 1.3 : o.size * 2.4;
		if (c.type === "timeline") {
			// Eje vertical que crece con los hitos.
			ctx.strokeStyle = T.line(0.5 * o.out);
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(o.x + 6, y + row * 0.15);
			ctx.lineTo(o.x + 6, y + row * 0.15 + (n - 0.6) * row * eo(seg(o.k, 0.3, 0.3 + n * STAGGER)));
			ctx.stroke();
		}
		items.forEach((it, i) => {
			const k = at(i);
			const base = y + row * 0.72;
			if (k > 0) {
				const mx = c.type === "timeline" ? o.x + 26 : o.x;
				if (c.type === "timeline") {
					ctx.fillStyle = T.acc(o.out);
					ctx.beginPath();
					ctx.arc(o.x + 6, base - o.size * 0.3, 7 * eo(k), 0, Math.PI * 2);
					ctx.fill();
				}
				const markSize = U.fitFont(ctx, it.mark, 400, o.size * 0.62, U.FONT.mono, markW - 14, 14);
				ctx.font = `${markSize}px ${U.FONT.mono}`;
				ctx.fillStyle = T.acc(o.out);
				ctx.fillText(U.rollText(it.mark, k, o.frame, 5 + i), mx, base);
				const tx = mx + markW;
				const size = U.fitFont(
					ctx,
					it.text.toUpperCase(),
					500,
					o.size * 0.8,
					U.FONT.ui,
					o.x + o.w - tx,
					18,
				);
				ctx.font = `500 ${size}px ${U.FONT.ui}`;
				ctx.letterSpacing = "2px";
				ctx.fillStyle = T.hi(0.95 * o.out);
				ctx.fillText(U.rollText(it.text.toUpperCase(), k, o.frame, 9 + i), tx, base);
				ctx.letterSpacing = "0px";
			}
			y += row;
		});
	} else if (c.type === "compare") {
		const gap = o.size * 1.2;
		const w = (o.w - gap) / 2;
		c.items.forEach((it, i) => {
			const k = at(i);
			if (k <= 0) return;
			const x = o.x + i * (w + gap);
			ctx.strokeStyle = (i === 1 ? T.acc : T.line)(0.8 * o.out * eo(k));
			ctx.lineWidth = 1.5;
			ctx.strokeRect(x, y, w, row - 16);
			const size = U.fitFont(
				ctx,
				it.label.toUpperCase(),
				600,
				o.size * 0.95,
				U.FONT.ui,
				w - 24,
				16,
			);
			ctx.font = `600 ${size}px ${U.FONT.ui}`;
			ctx.textAlign = "center";
			ctx.fillStyle = T.hi(0.95 * o.out);
			ctx.fillText(
				U.rollText(it.label.toUpperCase(), k, o.frame, 4 + i),
				x + w / 2,
				y + row * 0.42,
			);
			if (it.detail) {
				const ds = U.fitFont(ctx, it.detail, 400, o.size * 0.5, U.FONT.mono, w - 24, 12);
				ctx.font = `${ds}px ${U.FONT.mono}`;
				ctx.fillStyle = T.acc(o.out);
				ctx.fillText(U.rollText(it.detail, k, o.frame, 7 + i), x + w / 2, y + row * 0.68);
			}
			ctx.textAlign = "left";
		});
		const vs = at(0.5);
		if (vs > 0) {
			ctx.font = `${Math.round(o.size * 0.55)}px ${U.FONT.mono}`;
			ctx.textAlign = "center";
			ctx.fillStyle = T.acc(o.out * vs);
			ctx.fillText("VS", o.x + o.w / 2, y + row * 0.45);
			ctx.textAlign = "left";
		}
	} else {
		const max = Math.max(...c.bars.map((b) => b.value), 1e-9);
		const labelW = o.w * 0.34;
		const barMax = o.w - labelW - o.size * 2.2;
		c.bars.forEach((bar, i) => {
			const k = at(i);
			if (k > 0) {
				const mid = y + row * 0.5;
				const ls = U.fitFont(
					ctx,
					bar.label.toUpperCase(),
					400,
					o.size * 0.5,
					U.FONT.mono,
					labelW - 12,
					12,
				);
				ctx.font = `${ls}px ${U.FONT.mono}`;
				ctx.fillStyle = T.dim(0.95 * o.out);
				ctx.fillText(U.rollText(bar.label.toUpperCase(), k, o.frame, 2 + i), o.x, mid + ls * 0.35);
				const w = Math.max(3, (bar.value / max) * barMax * eo(k));
				const bh = row * 0.5;
				const top = bar.value === max;
				ctx.fillStyle = (top ? T.acc : T.line)(0.22 * o.out);
				ctx.fillRect(o.x + labelW, mid - bh / 2, w, bh);
				ctx.strokeStyle = (top ? T.acc : T.line)(0.95 * o.out);
				ctx.lineWidth = 1.5;
				ctx.strokeRect(o.x + labelW, mid - bh / 2, w, bh);
				const v = bar.value * eo(k);
				const shown = `${v.toLocaleString("es-ES", { maximumFractionDigits: bar.value < 10 ? 1 : 0 })}${c.suffix ?? ""}`;
				ctx.font = `600 ${Math.round(o.size * 0.62)}px ${U.FONT.ui}`;
				ctx.fillStyle = (top ? T.acc : T.hi)(o.out);
				ctx.fillText(shown, o.x + labelW + w + 12, mid + o.size * 0.22);
			}
			y += row;
		});
	}
	ctx.restore();
}

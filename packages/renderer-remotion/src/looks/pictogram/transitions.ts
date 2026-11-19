import type { PictogramEngine } from "./vendor/engine.js";

// Transiciones "de rejilla" entre escenas: la imagen nueva entra por filas, columnas, cuartos de
// círculo, losetas que giran… Adaptadas de `composite()` y `flip()` del film.js de
// pictogram-motion (Lemo-Opuscar, MIT) para cualquier tamaño de video (allí eran fijas a 1920×1080).

export type Transition = "rows" | "cols" | "quarter" | "flip" | "split" | "slide";
export const TRANSITIONS: readonly Transition[] = [
	"rows",
	"quarter",
	"cols",
	"flip",
	"split",
	"slide",
];

export function composite(
	G: PictogramEngine,
	ctx: CanvasRenderingContext2D,
	type: Transition,
	p: number,
	A: HTMLCanvasElement,
	B: HTMLCanvasElement,
) {
	const { E, clamp } = G;
	const W = A.width;
	const H = A.height;
	const S = G.CELL;
	const rows = Math.ceil(H / S);
	const cols = Math.ceil(W / S);
	if (type === "rows") {
		ctx.drawImage(A, 0, 0);
		for (let j = 0; j < rows; j++) {
			const pj = E.ioExp(clamp(p * 1.5 - j * (0.6 / rows)));
			const dir = j % 2 ? 1 : -1;
			ctx.drawImage(A, 0, j * S, W, S, dir * W * 0.25 * pj, j * S, W, S);
			ctx.drawImage(B, 0, j * S, W, S, -dir * W * (1 - pj), j * S, W, S);
		}
	} else if (type === "cols") {
		const n = Math.ceil(W / 240);
		const cw = W / n;
		ctx.drawImage(A, 0, 0);
		for (let i = 0; i < n; i++) {
			const pj = E.ioExp(clamp(p * 1.5 - i * (0.56 / n)));
			const dir = i % 2 ? 1 : -1;
			ctx.drawImage(B, i * cw, 0, cw, H, i * cw, -dir * H * (1 - pj), cw, H);
		}
	} else if (type === "slide") {
		const pj = E.ioExp(p);
		ctx.drawImage(A, -W * 0.3 * pj, 0);
		ctx.drawImage(B, W * (1 - pj), 0);
		ctx.fillStyle = `rgba(0,0,0,${0.15 * (1 - Math.abs(pj - 0.5) * 2)})`;
		ctx.fillRect(W * (1 - pj) - 8, 0, 8, H);
	} else if (type === "split") {
		const pj = E.ioExp(p);
		ctx.drawImage(A, 0, 0);
		ctx.drawImage(B, 0, 0, W / 2, H, 0, -H * (1 - pj), W / 2, H);
		ctx.drawImage(B, W / 2, 0, W / 2, H, W / 2, H * (1 - pj), W / 2, H);
	} else if (type === "quarter") {
		ctx.drawImage(A, 0, 0);
		ctx.save();
		ctx.beginPath();
		for (let j = 0; j < rows; j++)
			for (let i = 0; i < cols; i++) {
				const d = (i + j) * (0.6 / (rows + cols));
				const r = S * 1.42 * E.o3(clamp((p - d) / 0.55));
				if (r <= 0) continue;
				const corner = (i + j) % 4;
				const cx = i * S + (corner === 1 || corner === 2 ? S : 0);
				const cy = j * S + (corner >= 2 ? S : 0);
				ctx.moveTo(cx, cy);
				ctx.arc(cx, cy, r, 0, Math.PI * 2);
			}
		ctx.clip();
		ctx.drawImage(B, 0, 0);
		ctx.restore();
	} else {
		ctx.drawImage(B, 0, 0);
		ctx.fillStyle = "rgba(0,0,0,0.4)";
		ctx.fillRect(0, 0, W, H);
		for (let j = 0; j < rows; j++)
			for (let i = 0; i < cols; i++) {
				const d = ((i * 0.6 + j) / (cols * 0.6 + rows)) * 0.5;
				const pc = clamp((p - d) / 0.5);
				const src = pc < 0.5 ? A : B;
				const sx = Math.abs(Math.cos(pc * Math.PI));
				const x = i * S;
				const y = j * S;
				const w = S * sx;
				ctx.drawImage(src, x, y, S, S, x + (S - w) / 2, y, Math.max(1, w), S);
				if (pc > 0 && pc < 1) {
					ctx.fillStyle = `rgba(0,0,0,${0.3 * (1 - sx)})`;
					ctx.fillRect(x + (S - w) / 2, y, w, S);
				}
			}
	}
}

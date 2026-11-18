import { type HoloModel, normalizeModel, prepModel, type Vec3 } from "./vendor/holo.js";
import { Model } from "./vendor/mkmodel.js";

// Modelos 3D del estilo Holograma, hechos con figuras básicas (como los de Lemo-Opuscar). Cada uno
// tiene varias partes con nombre: las escenas de cifra apuntan a una parte distinta cada vez.

export type HoloModelId = "planet" | "ringed" | "satellite" | "rocket";

/** Esfera de alambre: paralelos + meridianos, con caras para el efecto sólido. */
function sphere(M: Model, c: Vec3, r: number, lat = 10, lon = 16) {
	const rows: number[][] = [];
	for (let i = 1; i < lat; i++) {
		const phi = (Math.PI * i) / lat;
		const y = c[1] + r * Math.cos(phi);
		const rr = r * Math.sin(phi);
		const row: number[] = [];
		for (let j = 0; j < lon; j++) {
			const th = (2 * Math.PI * j) / lon;
			row.push(M.vtx([c[0] + rr * Math.cos(th), y, c[2] + rr * Math.sin(th)]));
		}
		rows.push(row);
	}
	const top = M.vtx([c[0], c[1] + r, c[2]]);
	const bottom = M.vtx([c[0], c[1] - r, c[2]]);
	rows.forEach((row, i) => {
		row.forEach((v, j) => {
			const next = row[(j + 1) % lon] as number;
			M.edge(v, next);
			const below = rows[i + 1];
			if (below) {
				M.edge(v, below[j] as number);
				M.quad(v, next, below[(j + 1) % lon] as number, below[j] as number);
			}
		});
	});
	for (let j = 0; j < lon; j += 2) {
		M.edge(top, (rows[0] as number[])[j] as number);
		M.edge(bottom, (rows[rows.length - 1] as number[])[j] as number);
	}
}

/** Cono (morro de un cohete): anillos que se estrechan hasta la punta. */
function cone(M: Model, base: Vec3, h: number, r: number, rings = 5, seg = 14) {
	const R: number[][] = [];
	for (let k = 0; k < rings; k++) {
		const f = k / rings;
		R.push(M.circle([base[0], base[1] + h * f, base[2]], [0, 1, 0], r * (1 - f), seg));
	}
	const tip = M.vtx([base[0], base[1] + h, base[2]]);
	for (let i = 0; i < seg; i += 2) {
		for (let k = 0; k < rings - 1; k++)
			M.edge((R[k] as number[])[i] as number, (R[k + 1] as number[])[i] as number);
		M.edge((R[rings - 1] as number[])[i] as number, tip);
	}
}

const builders: Record<HoloModelId, () => Model> = {
	planet: () => {
		const M = new Model("planet");
		M.part("planet", { anchor: [0.62, 1.15, 0] });
		M.piece("planet-shell");
		sphere(M, [0, 0.95, 0], 0.75, 12, 20);
		M.part("core", { anchor: [0, 0.95, 0] });
		M.piece("core", { explode: [0, 0.25, 0], hot: true });
		sphere(M, [0, 0.95, 0], 0.3, 6, 10);
		M.part("moon", { anchor: [1.25, 1.35, 0.2] });
		M.piece("moon-orbit");
		M.circle([0, 0.95, 0], [0.18, 1, -0.1], 1.25, 48);
		M.piece("moon", { explode: [0.15, 0.1, 0] });
		sphere(M, [1.2, 1.3, 0.25], 0.13, 6, 10);
		return M;
	},
	ringed: () => {
		const M = new Model("ringed");
		M.part("planet", { anchor: [0.4, 1.4, 0] });
		M.piece("planet-shell");
		sphere(M, [0, 0.95, 0], 0.62, 12, 20);
		M.part("rings", { anchor: [1.15, 0.92, 0.2] });
		M.piece("rings", { explode: [0, -0.1, 0] });
		M.disc([0, 0.95, 0], [0.12, 1, 0.22], 1.2, { rings: [0.82, 0.95, 1.05, 1.2], seg: 48 });
		M.part("core", { anchor: [0, 0.95, 0] });
		M.piece("core", { explode: [0, 0.25, 0], hot: true });
		sphere(M, [0, 0.95, 0], 0.25, 6, 10);
		return M;
	},
	satellite: () => {
		const M = new Model("satellite");
		M.part("body", { anchor: [0.2, 1.1, 0.2] });
		M.piece("body");
		M.box([0, 0.95, 0], [0.42, 0.5, 0.42]);
		M.tube([0, 0.7, 0], [0, 0.6, 0], 0.12, { rings: 3, seg: 12 });
		for (const side of [-1, 1]) {
			M.part(side < 0 ? "panel-left" : "panel-right", { anchor: [side * 1.0, 0.95, 0] });
			M.piece(side < 0 ? "panel-left" : "panel-right", { explode: [side * 0.25, 0, 0] });
			M.tube([side * 0.21, 0.95, 0], [side * 0.36, 0.95, 0], 0.02, { rings: 2, seg: 6 });
			for (let k = 0; k < 3; k++) M.box([side * (0.52 + k * 0.32), 0.95, 0], [0.3, 0.02, 0.5]);
		}
		M.part("antenna", { anchor: [0, 1.62, 0] });
		M.piece("antenna", { explode: [0, 0.2, 0] });
		M.tube([0, 1.2, 0], [0, 1.4, 0], 0.02, { rings: 2, seg: 6 });
		M.disc([0, 1.45, 0], [0, 1, 0.35], 0.28, { rings: [0.08, 0.18, 0.28], seg: 20 });
		return M;
	},
	rocket: () => {
		const M = new Model("rocket");
		M.part("body", { anchor: [0.2, 1.1, 0] });
		M.piece("body");
		M.tube([0, 0.35, 0], [0, 1.55, 0], 0.2, { rings: 9, seg: 16, longs: 4 });
		M.part("nose", { anchor: [0, 2.05, 0] });
		M.piece("nose", { explode: [0, 0.25, 0] });
		cone(M, [0, 1.55, 0], 0.5, 0.2);
		M.part("fins", { anchor: [0.4, 0.4, 0] });
		M.piece("fins", { explode: [0, -0.1, 0] });
		for (let k = 0; k < 4; k++) {
			const a = (Math.PI / 2) * k;
			const [x, z] = [Math.cos(a), Math.sin(a)];
			const p = (r: number, y: number): Vec3 => [x * r, y, z * r];
			const ids = [p(0.2, 0.75), p(0.42, 0.3), p(0.42, 0.12), p(0.2, 0.35)].map((v) => M.vtx(v));
			ids.forEach((id, i) => {
				M.edge(id, ids[(i + 1) % ids.length] as number);
			});
			M.quad(ids[0] as number, ids[1] as number, ids[2] as number, ids[3] as number);
		}
		M.part("engine", { anchor: [0, 0.12, 0] });
		M.piece("engine", { explode: [0, -0.2, 0], hot: true });
		M.tube([0, 0.35, 0], [0, 0.12, 0], 0.13, { rings: 3, seg: 12 });
		return M;
	},
};

const cache = new Map<HoloModelId, HoloModel>();

/** Modelo listo para el motor (normalizado al tamaño de escena del original). */
export function holoModel(id: HoloModelId): HoloModel {
	let model = cache.get(id);
	if (!model) {
		model = normalizeModel(prepModel(builders[id]().toJSON()));
		cache.set(id, model);
	}
	return model;
}

export const isHoloModelId = (id: string | undefined): id is HoloModelId =>
	id === "planet" || id === "ringed" || id === "satellite" || id === "rocket";

/** Radio de la esfera que envuelve el modelo, centrada a media altura (para encuadrarlo). */
export function modelRadius(model: HoloModel): number {
	const cy = model.ymax / 2;
	let r = 0;
	for (const part of model.parts)
		for (const piece of part.pieces as { v: Float32Array }[])
			for (let i = 0; i < piece.v.length; i += 3)
				r = Math.max(
					r,
					Math.hypot(
						piece.v[i] as number,
						(piece.v[i + 1] as number) - cy,
						piece.v[i + 2] as number,
					),
				);
	return r;
}

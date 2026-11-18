// Tipos (escritos para Frameflow) del constructor de modelos de Lemo-Opuscar (mkmodel.mjs, MIT).
import type { Vec3 } from "./holo.js";
export class Model {
	constructor(name: string);
	part(id: string, o?: { anchor?: Vec3; center?: Vec3; tagDir?: number }): void;
	piece(id: string, o?: { explode?: Vec3; axis?: { c: Vec3; d: Vec3 }; hot?: boolean }): void;
	vtx(p: Vec3): number;
	edge(a: number, b: number): void;
	quad(a: number, b: number, c: number, d: number): void;
	circle(c: Vec3, n: Vec3, r: number, seg: number): number[];
	ring(c: Vec3, n: Vec3, r: number, seg: number, width?: number): unknown;
	tube(a: Vec3, b: Vec3, r: number, o?: { rings?: number; seg?: number; longs?: number }): number[][];
	box(c: Vec3, s: Vec3): void;
	disc(c: Vec3, n: Vec3, r: number, o?: { rings?: number[]; seg?: number }): void;
	toJSON(): unknown;
}

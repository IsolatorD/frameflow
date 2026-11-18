// Tipos (escritos para Frameflow) del motor de wireframe de Lemo-Opuscar (holo.js, MIT).
export type Vec3 = [number, number, number];
export type BBox = [number, number, number, number];
export type Camera = {
	target: Vec3;
	yaw: number;
	pitch: number;
	dist: number;
	fov?: number;
	cx?: number;
	cy?: number;
	roll?: number;
};
export type HoloModel = {
	name?: string;
	parts: { id: string; anchor: Vec3; pieces: unknown[] }[];
	ymin: number;
	ymax: number;
	byId: Record<string, { id: string; anchor: Vec3; pieces: { id: string }[] }>;
};
export type DrawInfo = {
	bbox: Record<string, BBox>;
	anchor: Record<string, [number, number]>;
	project: (x: number, y: number, z: number, out: Float32Array | number[]) => number[];
};
export function prepModel(json: unknown): HoloModel;
export function normalizeModel(model: HoloModel, diag?: number): HoloModel;
export function makeCamera(cam: Camera, W: number, H: number): { project: DrawInfo["project"] };
export class Holo {
	constructor(W: number, H: number);
	draw(ctx: CanvasRenderingContext2D, model: HoloModel, cam: Camera, o?: Record<string, unknown>): DrawInfo;
}
export function drawPad(ctx: CanvasRenderingContext2D, cam: Camera, W: number, H: number, o?: Record<string, unknown>): void;
export function drawScanPlane(ctx: CanvasRenderingContext2D, cam: Camera, W: number, H: number, y: number, o?: Record<string, unknown>): void;

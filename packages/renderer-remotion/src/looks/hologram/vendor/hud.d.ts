// Tipos (escritos para Frameflow) de la capa de interfaz de Lemo-Opuscar (hud.js, MIT).
import type { BBox } from "./holo.js";
export type HudTheme = {
	hue: number;
	accentHue: number;
	line: (a: number) => string;
	hi: (a: number) => string;
	dim: (a: number) => string;
	acc: (a: number) => string;
	bg0: string;
	bg1: string;
};
type Ctx = CanvasRenderingContext2D;
export const FONT: { ui: string; mono: string };
export function clamp(x: number, a?: number, b?: number): number;
export function theme(hue?: number, accent?: number): HudTheme;
export function background(ctx: Ctx, W: number, H: number, T: HudTheme, o?: Record<string, unknown>): void;
export function vignette(ctx: Ctx, W: number, H: number, k?: number): void;
export function plate(ctx: Ctx, T: HudTheme, x: number, y: number, w: number, h: number, a?: number, o?: Record<string, unknown>): void;
export function chrome(ctx: Ctx, W: number, H: number, T: HudTheme, o?: Record<string, unknown>): void;
export function targetBox(ctx: Ctx, T: HudTheme, bb: BBox, k: number, o?: Record<string, unknown>): void;
export function leader(ctx: Ctx, T: HudTheme, from: [number, number], elbow: [number, number], to: [number, number], prog: number, o?: Record<string, unknown>): void;
export function rollText(str: string, k: number, frame: number, seed?: number): string;
export function fitFont(ctx: Ctx, text: string, weight: number, size: number, family: string, maxW: number, minSize?: number): number;
export function wrap(ctx: Ctx, text: string, maxW: number): string[];
export function specCard(
	ctx: Ctx,
	T: HudTheme,
	x: number,
	y: number,
	c: { label: string; value: string; unit?: string; detail?: string },
	st: { reveal: number; roll: number; detail: number; frame: number; flash?: boolean },
	o?: Record<string, unknown>,
): { w: number; h: number };
export function glitch(ctx: Ctx, W: number, H: number, amt: number, seed: number): void;
export function beam(ctx: Ctx, T: HudTheme, project: (x: number, y: number, z: number, o: number[]) => number[], a: number, t: number, o?: Record<string, unknown>): void;

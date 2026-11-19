// Masterizado del video final: sonoridad integrada de −14 LUFS (lo que esperan TikTok, YouTube,
// Instagram…) con el pico real por debajo de −1,5 dBTP, en dos pasadas del filtro `loudnorm` de
// ffmpeg (EBU R128): la primera mide y la segunda aplica una ganancia lineal (sin comprimir la
// dinámica) usando lo medido.
// Idea tomada de teardown (sfx/loudness.py, MIT) y de la skill «sonido» de skills-videos-cortos.

export const LOUDNESS_TARGET = { integrated: -14, truePeak: -1.5, range: 11 } as const;

export type LoudnessMeasure = {
	/** Sonoridad integrada (LUFS); -Infinity si es silencio. */
	integrated: number;
	truePeak: number;
	range: number;
	threshold: number;
	offset: number;
};

const num = (v: unknown) => {
	const n = typeof v === "string" ? Number.parseFloat(v) : Number.NaN;
	return Number.isFinite(n) ? n : -Infinity;
};

/** Lee el informe JSON que `loudnorm` escribe al final de la salida de error de ffmpeg. */
export function parseLoudnorm(
	stderr: string,
	which: "input" | "output" = "input",
): LoudnessMeasure {
	const blocks = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/g);
	const last = blocks?.at(-1);
	if (!last) throw new Error("ffmpeg no devolvió la medición de sonoridad");
	const j = JSON.parse(last) as Record<string, string>;
	return {
		integrated: num(j[`${which}_i`]),
		truePeak: num(j[`${which}_tp`]),
		range: num(j[`${which}_lra`]),
		threshold: num(j[`${which}_thresh`]),
		offset: num(j.target_offset),
	};
}

const T = LOUDNESS_TARGET;

/** Filtro de la primera pasada (solo mide). */
export const loudnormMeasureFilter = `loudnorm=I=${T.integrated}:TP=${T.truePeak}:LRA=${T.range}:print_format=json`;

/** ¿Hay sonido que masterizar? (un video mudo mide -inf). */
export const hasSound = (m: LoudnessMeasure) => Number.isFinite(m.integrated) && m.integrated > -70;

/** Filtro de la segunda pasada: ganancia lineal hasta −14 LUFS con lo medido. */
export const loudnormApplyFilter = (m: LoudnessMeasure) =>
	[
		`loudnorm=I=${T.integrated}:TP=${T.truePeak}:LRA=${T.range}`,
		`measured_I=${m.integrated}`,
		`measured_TP=${m.truePeak}`,
		`measured_LRA=${m.range}`,
		`measured_thresh=${m.threshold}`,
		`offset=${m.offset}`,
		"linear=true",
		"print_format=json",
	].join(":");

/** "−14,0 LUFS" para mostrar. */
export const formatLufs = (lufs: number) =>
	`${lufs < 0 ? "−" : ""}${Math.abs(lufs).toFixed(1).replace(".", ",")} LUFS`;

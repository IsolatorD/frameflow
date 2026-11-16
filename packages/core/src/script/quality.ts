import { estimateSeconds, type Script } from "./script";

// Métricas automáticas de calidad de un guion. No miden si los datos son ciertos (eso necesita
// a una persona o a un modelo mejor), pero sí los defectos típicos de los modelos pequeños.

const STOPWORDS = new Set(
	"el la los las un una unos unas de del al a en y o que es son se su sus por para con como lo le les no mas más muy pero ya tan este esta estos estas ese esa eso the of and to in is it that".split(
		" ",
	),
);

/** "¿Sabías que…?" → ["sabias", "que"]. */
export const normalizeWords = (text: string): string[] =>
	text
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.split(/\s+/)
		.filter(Boolean);

const contentWords = (text: string) =>
	new Set(normalizeWords(text).filter((w) => !STOPWORDS.has(w)));

/** ¿La línea es un trozo literal (de 3+ palabras) de la narración, en vez de un resumen? */
export const isCopiedLine = (line: string, narration: string): boolean => {
	const words = normalizeWords(line);
	if (words.length < 3) return false;
	return ` ${normalizeWords(narration).join(" ")} `.includes(` ${words.join(" ")} `);
};

/** Parecido entre dos narraciones según sus palabras con contenido (0 = nada, 1 = iguales). */
export const similarity = (a: string, b: string): number => {
	const x = contentWords(a);
	const y = contentWords(b);
	if (x.size === 0 || y.size === 0) return 0;
	let shared = 0;
	for (const w of x) if (y.has(w)) shared++;
	return shared / Math.min(x.size, y.size);
};

/** Umbral a partir del cual dos escenas cuentan como "la misma idea". */
export const REPEAT_THRESHOLD = 0.6;

export type QualityReport = {
	scenes: number;
	seconds: number;
	/** Duración estimada / duración pedida. */
	durationRatio: number;
	statScenes: number;
	lines: number;
	copiedLines: number;
	/** Pares de escenas (índices desde 0) que repiten la misma idea. */
	repeatedPairs: [number, number][];
};

export const qualityReport = (script: Script, targetSeconds: number): QualityReport => {
	const seconds = script.scenes.reduce((t, s) => t + estimateSeconds(s.narration), 0);
	let lines = 0;
	let copiedLines = 0;
	for (const scene of script.scenes) {
		if (scene.content.type !== "kinetic-text") continue;
		for (const line of scene.content.lines) {
			lines++;
			if (isCopiedLine(line.text, scene.narration)) copiedLines++;
		}
	}
	const repeatedPairs: [number, number][] = [];
	script.scenes.forEach((a, i) => {
		script.scenes.slice(i + 1).forEach((b, k) => {
			if (similarity(a.narration, b.narration) >= REPEAT_THRESHOLD)
				repeatedPairs.push([i, i + 1 + k]);
		});
	});
	return {
		scenes: script.scenes.length,
		seconds: Math.round(seconds),
		durationRatio: Math.round((seconds / targetSeconds) * 100) / 100,
		statScenes: script.scenes.filter((s) => s.content.type === "stat").length,
		lines,
		copiedLines,
		repeatedPairs,
	};
};

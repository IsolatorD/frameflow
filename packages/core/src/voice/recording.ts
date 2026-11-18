import type { WordTiming } from "./timing";

// Voz grabada por el usuario: limpieza del audio (recortar silencios, igualar volumen), cambio de
// frecuencia de muestreo y alineación de lo que "oye" Whisper con el texto del guion, para que los
// subtítulos muestren las palabras del guion en el momento en que se dicen.

/** Recorta el silencio del principio y del final, dejando un pequeño margen. */
export function trimSilence(
	pcm: Float32Array,
	sampleRate: number,
	{ threshold = 0.02, marginMs = 120 } = {},
): Float32Array {
	const win = Math.max(1, Math.round(sampleRate * 0.01));
	const loud = (i: number) => {
		let sum = 0;
		const end = Math.min(pcm.length, i + win);
		for (let k = i; k < end; k++) sum += (pcm[k] as number) ** 2;
		return Math.sqrt(sum / Math.max(1, end - i)) >= threshold;
	};
	let start = 0;
	while (start < pcm.length && !loud(start)) start += win;
	let end = pcm.length;
	while (end > start && !loud(Math.max(0, end - win))) end -= win;
	if (start >= end) return pcm.slice(0, 0);
	const margin = Math.round((sampleRate * marginMs) / 1000);
	return pcm.slice(Math.max(0, start - margin), Math.min(pcm.length, end + margin));
}

/**
 * Iguala el volumen: lleva el nivel medio (RMS) de la voz a `targetRms` sin que ningún pico pase de
 * `maxPeak` (así todas las tomas suenan parecido y nada satura).
 */
export function normalizeVolume(
	pcm: Float32Array,
	{ targetRms = 0.1, maxPeak = 0.95 } = {},
): Float32Array {
	let sum = 0;
	let peak = 0;
	for (const v of pcm) {
		sum += v * v;
		peak = Math.max(peak, Math.abs(v));
	}
	if (pcm.length === 0 || peak === 0) return pcm;
	const rms = Math.sqrt(sum / pcm.length);
	const gain = Math.min(targetRms / rms, maxPeak / peak);
	return pcm.map((v) => v * gain);
}

/** Cambia la frecuencia de muestreo (interpolación lineal; suficiente para voz). */
export function resample(pcm: Float32Array, from: number, to: number): Float32Array {
	if (from === to) return pcm;
	const length = Math.max(1, Math.round((pcm.length * to) / from));
	const out = new Float32Array(length);
	const ratio = (pcm.length - 1) / Math.max(1, length - 1);
	for (let i = 0; i < length; i++) {
		const x = i * ratio;
		const a = Math.floor(x);
		const b = Math.min(pcm.length - 1, a + 1);
		out[i] = (pcm[a] as number) + ((pcm[b] as number) - (pcm[a] as number)) * (x - a);
	}
	return out;
}

/** "¿Sabías" → "sabias": para comparar el guion con lo que oyó Whisper. */
export const normalizeWord = (word: string) =>
	word
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/[^\p{L}\p{N}]/gu, "");

export type HeardWord = { text: string; start: number; end: number };

/**
 * Tiempos de cada palabra del guion a partir de lo que oyó Whisper: se emparejan las palabras
 * iguales en orden (subsecuencia común más larga) y las que no se emparejan reparten el hueco
 * entre la anterior y la siguiente conocidas.
 */
export function alignWords(text: string, heard: readonly HeardWord[], total: number): WordTiming[] {
	const words = text.split(/\s+/).filter(Boolean);
	const a = words.map(normalizeWord);
	const b = heard.map((h) => normalizeWord(h.text));
	// LCS por programación dinámica (los guiones de una escena son cortos).
	const n = a.length;
	const m = b.length;
	const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
	for (let i = n - 1; i >= 0; i--)
		for (let j = m - 1; j >= 0; j--)
			(dp[i] as number[])[j] =
				a[i] && a[i] === b[j]
					? ((dp[i + 1] as number[])[j + 1] as number) + 1
					: Math.max((dp[i + 1] as number[])[j] as number, (dp[i] as number[])[j + 1] as number);
	const times: ({ start: number; end: number } | null)[] = words.map(() => null);
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (a[i] && a[i] === b[j]) {
			const h = heard[j] as HeardWord;
			times[i] = { start: h.start, end: h.end };
			i++;
			j++;
		} else if (((dp[i + 1] as number[])[j] as number) >= ((dp[i] as number[])[j + 1] as number))
			i++;
		else j++;
	}
	const round = (x: number) => Math.round(x * 1000) / 1000;
	return words.map((word, k) => {
		let t = times[k];
		if (!t) {
			const prevEnd = times.slice(0, k).findLast(Boolean)?.end ?? 0;
			const nextIndex = times.findIndex((x, idx) => idx > k && x);
			const gapEnd = nextIndex >= 0 ? (times[nextIndex] as { start: number }).start : total;
			const unknown = (nextIndex >= 0 ? nextIndex : words.length) - k;
			t = { start: prevEnd, end: prevEnd + (gapEnd - prevEnd) / Math.max(1, unknown) };
			times[k] = t;
		}
		// Whisper a veces se pasa del final del audio: nunca más allá de la duración real.
		const start = Math.min(t.start, total);
		return { text: word, start: round(start), end: round(Math.min(total, Math.max(start, t.end))) };
	});
}

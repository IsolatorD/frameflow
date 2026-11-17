import { KOKORO_VOCAB } from "./kokoroModel";

// Tiempos por palabra a partir de lo que devuelve Kokoro: la duración de cada fonema. Así no hace
// falta un segundo modelo (Whisper) que "escuche" el audio. Los bordes se ajustan después a los
// silencios reales (pausas en comas, inicio y final), donde las duraciones del modelo fallan más.

export type WordTiming = { text: string; start: number; end: number };

/** Fonemas → ids del modelo. Los símbolos que el modelo no conoce se omiten (como en Python). */
export function tokenize(phonemes: string): { ids: number[]; symbols: string[] } {
	const symbols = [...phonemes].filter((c) => KOKORO_VOCAB[c] !== undefined);
	return { ids: symbols.map((c) => KOKORO_VOCAB[c] as number), symbols };
}

const isLetter = (c: string) => /[\p{L}ˈˌːˑ]/u.test(c);
const hasSpeech = (word: string) => /[\p{L}\p{N}]/u.test(word);

/**
 * Tiempos de cada palabra del texto ORIGINAL. `durations` trae una entrada por id más las de
 * inicio y fin; se escalan para que sumen `seconds` (el modelo no usa un paso fijo exacto).
 */
export function wordTimings(
	text: string,
	symbols: readonly string[],
	durations: readonly number[],
	seconds: number,
): WordTiming[] {
	const totalFrames = durations.reduce((a, b) => a + b, 0);
	const scale = totalFrames > 0 ? seconds / totalFrames : 0;
	// Grupos de fonemas separados por espacios (cada uno, una palabra pronunciada).
	const groups: { start: number; end: number }[] = [];
	let frame = durations[0] ?? 0;
	let current: { start: number; end: number } | null = null;
	symbols.forEach((symbol, i) => {
		const duration = durations[i + 1] ?? 0;
		if (symbol === " ") {
			if (current) groups.push(current);
			current = null;
		} else if (isLetter(symbol)) {
			current ??= { start: frame, end: frame };
			current.end = frame + duration;
		}
		frame += duration;
	});
	if (current) groups.push(current);

	const words = text.split(/\s+/).filter(Boolean);
	const spoken = words.map((w, i) => ({ w, i })).filter(({ w }) => hasSpeech(w));
	const times: ({ start: number; end: number } | null)[] = words.map(() => null);
	if (spoken.length === groups.length) {
		spoken.forEach(({ i }, k) => {
			const g = groups[k] as { start: number; end: number };
			times[i] = { start: g.start * scale, end: g.end * scale };
		});
	} else if (groups.length > 0) {
		// eSpeak juntó o separó palabras (siglas, números…): se reparte el habla en proporción a
		// la longitud de cada palabra entre el primer y el último sonido.
		const first = (groups[0] as { start: number }).start * scale;
		const last = (groups[groups.length - 1] as { end: number }).end * scale;
		const weights = spoken.map(({ w }) => w.replace(/[^\p{L}\p{N}]/gu, "").length || 1);
		const total = weights.reduce((a, b) => a + b, 0);
		let t = first;
		spoken.forEach(({ i }, k) => {
			const span = ((weights[k] as number) / total) * (last - first);
			times[i] = { start: t, end: t + span };
			t += span;
		});
	}
	// Palabras que son solo signos ("—") o sin tiempo: el hueco entre la anterior y la siguiente.
	return words.map((text, i) => {
		const own = times[i];
		if (own) return { text, ...round(own) };
		const prevEnd = times.slice(0, i).findLast(Boolean)?.end ?? 0;
		const next = times.slice(i + 1).find(Boolean);
		const start = prevEnd;
		const end = next ? Math.max(start, next.start) : start;
		return { text, ...round({ start, end }) };
	});
}

const round = ({ start, end }: { start: number; end: number }) => ({
	start: Math.round(start * 1000) / 1000,
	end: Math.round(end * 1000) / 1000,
});

/** Tramos de silencio del audio (energía por debajo de `threshold` durante al menos `minMs`). */
export function silences(
	audio: Float32Array,
	sampleRate: number,
	{ threshold = 0.01, minMs = 50 } = {},
): [number, number][] {
	const win = Math.round(sampleRate * 0.01);
	const runs: [number, number][] = [];
	let start: number | null = null;
	for (let i = 0; i + win <= audio.length; i += win) {
		let sum = 0;
		for (let k = i; k < i + win; k++) sum += (audio[k] as number) ** 2;
		const quiet = Math.sqrt(sum / win) < threshold;
		const t = i / sampleRate;
		if (quiet && start === null) start = t;
		if (!quiet && start !== null) {
			if (t - start >= minMs / 1000) runs.push([start, t]);
			start = null;
		}
	}
	if (start !== null) runs.push([start, audio.length / sampleRate]);
	return runs;
}

/** Duración mínima de un silencio para tomarlo como pausa entre palabras (segundos). */
const MIN_PAUSE = 0.1;

/** Ajusta inicio, final y pausas entre palabras a los silencios reales del audio. */
export function snapToSilences(
	words: readonly WordTiming[],
	gaps: readonly [number, number][],
	total: number,
): WordTiming[] {
	const out = words.map((w) => ({ ...w }));
	const spoken = out.filter((w) => hasSpeech(w.text));
	const first = spoken[0];
	const last = spoken[spoken.length - 1];
	if (!first || !last) return out;
	const lead = gaps.find(([s]) => s <= 0.001);
	if (lead && Math.abs(first.start - lead[1]) < 0.3)
		first.start = round({ start: lead[1], end: 0 }).start;
	const tail = gaps.find(([, e]) => e >= total - 0.001);
	if (tail && Math.abs(last.end - tail[0]) < 0.4)
		last.end = round({ start: tail[0], end: 0 }).start;
	for (let k = 0; k < spoken.length - 1; k++) {
		const a = spoken[k] as WordTiming;
		const b = spoken[k + 1] as WordTiming;
		// Una pausa real (coma, punto) dura bastante y cae en la frontera entre las dos palabras; los
		// silencios cortos dentro de una palabra (el cierre de una "t" o una "p") no cuentan.
		const gap = gaps.find(([s, e]) => {
			const middle = (s + e) / 2;
			return (
				e - s >= MIN_PAUSE &&
				middle >= a.end - 0.15 &&
				middle <= b.start + 0.1 &&
				s > a.start &&
				e < b.end
			);
		});
		if (gap) {
			a.end = round({ start: gap[0], end: 0 }).start;
			b.start = round({ start: gap[1], end: 0 }).start;
		} else if (b.start < a.end) {
			b.start = a.end;
		}
	}
	// Los signos sueltos quedan dentro del hueco que corresponda.
	out.forEach((w, i) => {
		if (hasSpeech(w.text)) return;
		const prev = out.slice(0, i).findLast((x) => hasSpeech(x.text));
		const next = out.slice(i + 1).find((x) => hasSpeech(x.text));
		w.start = prev?.end ?? 0;
		w.end = Math.max(w.start, next?.start ?? w.start);
	});
	return out;
}

/**
 * Parte un texto largo en trozos que quepan en el modelo, por frases (y si una frase no cabe,
 * por comas o palabras). `measure` devuelve cuántos fonemas ocupa un trozo.
 */
export function splitForModel(text: string, max: number, measure: (chunk: string) => number) {
	if (measure(text) <= max) return [text.trim()];
	const sentences = text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text];
	const pieces = sentences.flatMap((s) =>
		measure(s) <= max ? [s] : (s.match(/[^,;:]+[,;:]?\s*/g) ?? [s]),
	);
	const chunks: string[] = [];
	let current = "";
	for (const piece of pieces) {
		const candidate = current + piece;
		if (current && measure(candidate) > max) {
			chunks.push(current.trim());
			current = piece;
		} else current = candidate;
	}
	if (current.trim()) chunks.push(current.trim());
	return chunks;
}

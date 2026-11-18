import { describe, expect, it } from "vitest";
import { alignWords, normalizeVolume, normalizeWord, resample, trimSilence } from "./recording";

const tone = (seconds: number, sr: number, amp = 0.3) =>
	Float32Array.from({ length: Math.round(seconds * sr) }, (_, i) => amp * Math.sin(i / 3));

describe("voz grabada: audio", () => {
	it("recorta el silencio del principio y del final con margen", () => {
		const sr = 1000;
		const pcm = new Float32Array(3000);
		pcm.set(tone(1, sr), 1000); // sonido de 1 a 2 s
		const out = trimSilence(pcm, sr, { marginMs: 100 });
		expect(out.length).toBeGreaterThanOrEqual(1150);
		expect(out.length).toBeLessThanOrEqual(1250);
		expect(trimSilence(new Float32Array(1000), sr).length).toBe(0);
	});

	it("iguala el volumen sin saturar", () => {
		const quiet = normalizeVolume(tone(1, 1000, 0.01));
		const rms = Math.sqrt(quiet.reduce((s, v) => s + v * v, 0) / quiet.length);
		expect(rms).toBeCloseTo(0.1, 2);
		const peaky = Float32Array.from([0, 0, 0.9, 0, 0]);
		expect(Math.max(...normalizeVolume(peaky))).toBeLessThanOrEqual(0.95);
	});

	it("cambia la frecuencia de muestreo", () => {
		const out = resample(Float32Array.from([0, 1, 0, -1]), 4, 8);
		expect(out.length).toBe(8);
		expect(out[0]).toBe(0);
		expect(resample(tone(1, 48000), 48000, 16000).length).toBe(16000);
	});
});

describe("voz grabada: alineación con el guion", () => {
	it("normaliza palabras para compararlas", () => {
		expect(normalizeWord("¿Sabías")).toBe("sabias");
		expect(normalizeWord("Tierra.")).toBe("tierra");
	});

	it("usa los tiempos de Whisper para las palabras que coinciden y reparte las demás", () => {
		const heard = [
			{ text: " ¿Sabías", start: 0.2, end: 0.6 },
			{ text: " que", start: 0.6, end: 0.8 },
			{ text: " la", start: 0.8, end: 0.9 },
			{ text: " luz", start: 0.9, end: 1.2 },
			// Whisper escribe "8" donde el guion dice "ocho"
			{ text: " 8", start: 1.3, end: 1.6 },
			{ text: " minutos?", start: 1.6, end: 2.1 },
		];
		const words = alignWords("¿Sabías que la luz tarda ocho minutos?", heard, 2.5);
		expect(words.map((w) => w.text)).toEqual([
			"¿Sabías",
			"que",
			"la",
			"luz",
			"tarda",
			"ocho",
			"minutos?",
		]);
		expect(words[0]).toEqual({ text: "¿Sabías", start: 0.2, end: 0.6 });
		expect(words[6]).toEqual({ text: "minutos?", start: 1.6, end: 2.1 });
		// "tarda" y "ocho" reparten el hueco entre "luz" (1.2) y "minutos" (1.6).
		expect(words[4]).toEqual({ text: "tarda", start: 1.2, end: 1.4 });
		expect(words[5]).toEqual({ text: "ocho", start: 1.4, end: 1.6 });
	});

	it("no pasa de la duración real del audio", () => {
		const words = alignWords(
			"hola mundo",
			[
				{ text: "hola", start: 0.1, end: 0.5 },
				{ text: "mundo", start: 0.5, end: 6 },
			],
			5.71,
		);
		expect(words[1]).toEqual({ text: "mundo", start: 0.5, end: 5.71 });
	});

	it("sin nada reconocido, reparte toda la duración", () => {
		const words = alignWords("uno dos", [], 2);
		expect(words).toEqual([
			{ text: "uno", start: 0, end: 1 },
			{ text: "dos", start: 1, end: 2 },
		]);
	});
});

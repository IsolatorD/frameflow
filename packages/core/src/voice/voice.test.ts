import { describe, expect, it } from "vitest";
import {
	espeakLanguage,
	joinEspeakPhonemes,
	preservePunctuation,
	restorePunctuation,
	textToPhonemes,
	toKokoroPhonemes,
} from "./phonemes";
import { silences, snapToSilences, splitForModel, tokenize, wordTimings } from "./timing";

describe("fonemas (parte pura)", () => {
	it("separa y recoloca la puntuación como phonemizer", () => {
		const { chunks, marks } = preservePunctuation("¿Hola, mundo?");
		expect(chunks).toEqual(["Hola", "mundo"]);
		expect(marks.map((m) => m.position)).toEqual(["B", "I", "E"]);
		expect(restorePunctuation(["ola ", "mundo "], marks).trim()).toBe("¿ola, mundo?");
	});

	it("une los fonemas compuestos y adapta los símbolos a Kokoro", () => {
		expect(joinEspeakPhonemes("m_ˈu_tʃ_o tʃ_ˌo_k_o")).toBe("mˈut^ʃo t^ʃˌoko");
		expect(toKokoroPhonemes("mˈut^ʃo", "es")).toBe("mˈuʧo");
		expect(toKokoroPhonemes("hˈa^ɪ ɹˈo^ʊd", "en-us")).toBe("hˈI ɹˈOd");
		expect(espeakLanguage("en", "bf_emma")).toBe("en-gb");
		expect(espeakLanguage("es", "ef_dora")).toBe("es");
	});

	it("texto completo con un eSpeak simulado", () => {
		const fake = (chunk: string) =>
			chunk
				.trim()
				.split(/\s+/)
				.map((w) => [...w.toLowerCase()].join("_"))
				.join(" ");
		expect(textToPhonemes("Hola, (tú)!", "es", fake)).toBe("hola, (tú)!");
	});
});

describe("tiempos por palabra", () => {
	it("reparte las duraciones por palabra y las escala a la duración real", () => {
		const { symbols } = tokenize("ola mundo.");
		// inicio + 10 símbolos + fin; cada uno 1 "fotograma" → 12 fotogramas en 1,2 s
		const durations = new Array(symbols.length + 2).fill(1);
		const words = wordTimings("Hola mundo.", symbols, durations, 1.2);
		expect(words).toEqual([
			{ text: "Hola", start: 0.1, end: 0.4 },
			{ text: "mundo.", start: 0.5, end: 1 },
		]);
	});

	it("si eSpeak junta palabras, reparte en proporción y los signos sueltos van en el hueco", () => {
		const { symbols } = tokenize("abc def");
		const durations = new Array(symbols.length + 2).fill(1);
		const words = wordTimings("La NASA — lanza", symbols, durations, 0.9);
		expect(words.map((w) => w.text)).toEqual(["La", "NASA", "—", "lanza"]);
		expect(words[2]?.start).toBe(words[1]?.end);
		expect(words[3]?.end).toBeCloseTo(0.8, 3);
	});

	it("ajusta los bordes a los silencios del audio", () => {
		const sr = 1000;
		const audio = new Float32Array(1000);
		// sonido de 0,2 a 0,45 y de 0,6 a 0,9 s
		for (let i = 200; i < 450; i++) audio[i] = 0.5;
		for (let i = 600; i < 900; i++) audio[i] = 0.5;
		const gaps = silences(audio, sr);
		expect(gaps).toEqual([
			[0, 0.2],
			[0.45, 0.6],
			[0.9, 1],
		]);
		const snapped = snapToSilences(
			[
				{ text: "hierro,", start: 0.22, end: 0.55 },
				{ text: "el", start: 0.65, end: 0.88 },
			],
			gaps,
			1,
		);
		expect(snapped).toEqual([
			{ text: "hierro,", start: 0.2, end: 0.45 },
			{ text: "el", start: 0.6, end: 0.9 },
		]);
	});

	it("no confunde el cierre corto de una consonante con una pausa", () => {
		const snapped = snapToSilences(
			[
				{ text: "superficie", start: 0.36, end: 0.94 },
				{ text: "está", start: 0.97, end: 1.19 },
			],
			[[1.05, 1.11]],
			2,
		);
		expect(snapped[1]).toEqual({ text: "está", start: 0.97, end: 1.19 });
	});

	it("parte textos largos por frases para que quepan en el modelo", () => {
		const text = "Primera frase. Segunda frase, con coma. Tercera.";
		const chunks = splitForModel(text, 25, (s) => s.length);
		expect(chunks).toEqual(["Primera frase.", "Segunda frase, con coma.", "Tercera."]);
		expect(splitForModel("Corta.", 25, (s) => s.length)).toEqual(["Corta."]);
	});
});

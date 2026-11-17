import { readFileSync } from "node:fs";
import { join } from "node:path";
import { espeakChunks, fromEspeak } from "@frameflow/core/voice/phonemes";
import { afterAll, describe, expect, it } from "vitest";
import { startEspeak } from "./espeak";

// Referencia generada con la librería de Python (misaki + phonemizer) que usaba la app antes:
// los fonemas deben salir idénticos para que la voz suene igual. Usa el proceso real de eSpeak.
const fixture: { text: string; phonemes: string }[] = JSON.parse(
	readFileSync(join(import.meta.dirname, "fixtures/phonemes-es.json"), "utf8"),
);
const espeak = startEspeak(join(import.meta.dirname, "../../espeak-process.ts"));
afterAll(() => espeak.close());

describe("fonemas en español (eSpeak NG en su propio proceso)", () => {
	it("coinciden con los de Python", { timeout: 60_000 }, async () => {
		const mismatches = [];
		for (const { text, phonemes } of fixture) {
			const { chunks, marks } = espeakChunks(text);
			const got = fromEspeak(await espeak.phonemize(chunks, "es"), marks, "es");
			if (got !== phonemes) mismatches.push({ text, expected: phonemes, got });
		}
		expect(mismatches).toEqual([]);
	});
});

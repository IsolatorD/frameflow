import { describe, expect, it } from "vitest";
import { encodeWav16, SFX, SFX_SAMPLE_RATE, sfxEvents, synthSfx } from "./sfx";

const loudestAt = (pcm: Float32Array, window = 0.02) => {
	const w = Math.round(window * SFX_SAMPLE_RATE);
	let best = 0;
	let bestAt = 0;
	for (let i = 0; i + w <= pcm.length; i += w) {
		let sum = 0;
		for (let k = i; k < i + w; k++) sum += (pcm[k] as number) ** 2;
		if (sum > best) {
			best = sum;
			bestAt = i;
		}
	}
	return (bestAt + w / 2) / SFX_SAMPLE_RATE;
};

describe("efectos de sonido", () => {
	it("cada efecto dura lo declarado, no satura y es siempre igual", () => {
		for (const kind of ["whoosh", "pop", "chime"] as const) {
			const pcm = synthSfx(kind);
			expect(pcm.length).toBe(Math.round(SFX[kind].duration * SFX_SAMPLE_RATE));
			expect(Math.max(...pcm.map(Math.abs))).toBeLessThanOrEqual(0.8001);
			expect(pcm).toEqual(synthSfx(kind));
		}
	});

	it("el pico del barrido está donde se declara (para alinearlo con el corte)", () => {
		expect(loudestAt(synthSfx("whoosh"))).toBeCloseTo(SFX.whoosh.peak, 1);
		expect(loudestAt(synthSfx("pop"))).toBeLessThan(0.04);
	});

	it("genera un WAV de 16 bits válido", () => {
		const wav = encodeWav16(new Float32Array([0, 1, -1]));
		expect(new TextDecoder().decode(wav.slice(0, 4))).toBe("RIFF");
		expect(wav.length).toBe(44 + 6);
		expect(new DataView(wav.buffer).getInt16(46, true)).toBe(32767);
	});

	it("un barrido por cambio de escena, pop en las cifras y campanita con la llamada a la acción", () => {
		const events = sfxEvents(
			[
				{ start: 0, content: { type: "kinetic-text" } },
				{ start: 3, content: { type: "stat" } },
				{ start: 6, content: { type: "kinetic-text" } },
			],
			{ start: 7.5 },
		);
		expect(events).toEqual([
			{ kind: "whoosh", at: 3 },
			{ kind: "pop", at: 3.4 },
			{ kind: "whoosh", at: 6 },
			{ kind: "chime", at: 7.55 },
		]);
	});
});

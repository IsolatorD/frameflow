// Efectos de sonido sutiles, sintetizados en código (sin muestras de terceros, deterministas):
//   · barrido ("whoosh") en cada cambio de escena;
//   · "pop" cuando aparece una cifra;
//   · campanita cuando aparece la llamada a la acción.
// Un acento por momento, nunca por palabra. Cada efecto se coloca de modo que su PICO caiga en el
// instante del impacto: inicio = impacto − pico (regla de la skill «sonido» de
// skills-videos-cortos y de teardown, ambos MIT).

export const SFX_SAMPLE_RATE = 48_000;

export type SfxKind = "whoosh" | "pop" | "chime";

export const SFX: Record<SfxKind, { file: string; duration: number; peak: number; label: string }> =
	{
		whoosh: { file: "sfx/v1/whoosh.wav", duration: 0.7, peak: 0.3, label: "Barrido" },
		pop: { file: "sfx/v1/pop.wav", duration: 0.16, peak: 0.004, label: "Pop" },
		chime: { file: "sfx/v1/chime.wav", duration: 1.2, peak: 0.006, label: "Campanita" },
	};

export const SFX_VOLUME_RANGE = { min: 0, max: 1, step: 0.05 } as const;
export const DEFAULT_SFX_VOLUME = 0.4;

/** Generador pseudoaleatorio determinista (mulberry32). */
function rng(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Muestras del efecto (mono, 48 kHz, pico ≈ 0,8). */
export function synthSfx(kind: SfxKind, sampleRate = SFX_SAMPLE_RATE): Float32Array {
	const { duration, peak } = SFX[kind];
	const n = Math.round(duration * sampleRate);
	const out = new Float32Array(n);
	if (kind === "whoosh") {
		// Ruido filtrado cuyo filtro se abre hacia el pico y se cierra después.
		const r = rng(7);
		let low = 0;
		let low2 = 0;
		for (let i = 0; i < n; i++) {
			const t = i / sampleRate;
			const rise = Math.min(1, t / peak);
			const env = t < peak ? rise ** 2 : Math.exp(-(t - peak) / 0.12);
			const cutoff = 300 + 3200 * (t < peak ? rise : Math.exp(-(t - peak) / 0.15));
			const k = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
			low += k * (r() * 2 - 1 - low);
			low2 += k * (low - low2);
			out[i] = low2 * env;
		}
	} else if (kind === "pop") {
		// Seno que cae de tono rápidamente, con ataque inmediato.
		let phase = 0;
		for (let i = 0; i < n; i++) {
			const t = i / sampleRate;
			const freq = 180 + 420 * Math.exp(-t / 0.025);
			phase += (2 * Math.PI * freq) / sampleRate;
			const env = Math.min(1, t / peak) * Math.exp(-t / 0.04);
			out[i] = Math.sin(phase) * env;
		}
	} else {
		// Dos parciales en quinta (La5 y Mi6) y un armónico suave que se apagan.
		const partials: [number, number, number][] = [
			[880, 1, 0.5],
			[1318.5, 0.6, 0.35],
			[2637, 0.15, 0.18],
		];
		for (let i = 0; i < n; i++) {
			const t = i / sampleRate;
			const attack = Math.min(1, t / peak);
			let v = 0;
			for (const [f, a, d] of partials) v += a * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / d);
			out[i] = v * attack;
		}
	}
	let max = 0;
	for (const v of out) max = Math.max(max, Math.abs(v));
	if (max > 0) for (let i = 0; i < n; i++) out[i] = ((out[i] as number) / max) * 0.8;
	// Final suave para que no haga clic al cortarse.
	const tail = Math.min(n, Math.round(0.01 * sampleRate));
	for (let i = 0; i < tail; i++) out[n - 1 - i] = (out[n - 1 - i] as number) * (i / tail);
	return out;
}

/** WAV PCM de 16 bits, mono. */
export function encodeWav16(pcm: Float32Array, sampleRate = SFX_SAMPLE_RATE): Uint8Array {
	const bytes = new Uint8Array(44 + pcm.length * 2);
	const view = new DataView(bytes.buffer);
	const ascii = (o: number, s: string) => {
		for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
	};
	ascii(0, "RIFF");
	view.setUint32(4, 36 + pcm.length * 2, true);
	ascii(8, "WAVE");
	ascii(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	ascii(36, "data");
	view.setUint32(40, pcm.length * 2, true);
	pcm.forEach((v, i) => {
		view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, v)) * 32767), true);
	});
	return bytes;
}

export type SfxEvent = { kind: SfxKind; at: number };

/**
 * Dónde suena cada efecto: barrido en cada cambio de escena, pop poco después de que empiece una
 * escena de cifra (cuando el número entra) y campanita con la llamada a la acción.
 */
export function sfxEvents(
	scenes: readonly { start: number; content: { type: string } }[],
	cta?: { start: number } | null,
): SfxEvent[] {
	const events: SfxEvent[] = [];
	scenes.forEach((scene, i) => {
		if (i > 0) events.push({ kind: "whoosh", at: scene.start });
		if (scene.content.type === "stat") events.push({ kind: "pop", at: scene.start + 0.4 });
	});
	if (cta) events.push({ kind: "chime", at: cta.start + 0.05 });
	return events.sort((a, b) => a.at - b.at);
}

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { alignWords, resample } from "@frameflow/core/voice/recording";
import { describe, expect, it } from "vitest";
import { createWhisper } from "./whisper";

// Prueba real (descarga ~77 MB la primera vez): FRAMEFLOW_LIVE_WHISPER=1 y FRAMEFLOW_LIVE_WAV con una
// grabación de la frase de abajo. FRAMEFLOW_LIVE_HOME reutiliza la carpeta (y el modelo).
const text =
	"Su superficie está cubierta de óxido de hierro, el mismo material que forma la herrumbre en la Tierra.";

describe.skipIf(!process.env.FRAMEFLOW_LIVE_WHISPER)("Whisper real para voz grabada", () => {
	it("descarga, transcribe y alinea con el guion", { timeout: 900_000 }, async () => {
		const dataDir = process.env.FRAMEFLOW_LIVE_HOME ?? mkdtempSync(join(tmpdir(), "ff-whisper-"));
		const whisper = createWhisper({ dataDir });
		await whisper.ensureModel();
		expect(whisper.modelReady()).toBe(true);
		const wav = readFileSync(process.env.FRAMEFLOW_LIVE_WAV as string);
		const rate = wav.readUInt32LE(24);
		const pcm = Float32Array.from(
			new Int16Array(wav.buffer, wav.byteOffset + 44, (wav.length - 44) / 2),
			(x) => x / 32768,
		);
		const started = Date.now();
		const heard = await whisper.transcribe(resample(pcm, rate, 16_000), "es");
		const words = alignWords(text, heard, pcm.length / rate);
		console.log(`${Date.now() - started} ms`, heard.map((h) => h.text).join(" "));
		console.log(words.slice(0, 5));
		expect(words).toHaveLength(text.split(" ").length);
		expect(words[0]?.start).toBeGreaterThan(0.1);
		expect(words.at(-1)?.end).toBeLessThanOrEqual(pcm.length / rate + 0.01);
	});
});

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createVoiceEngine } from "./kokoro";

// Prueba real (descarga el modelo la primera vez): FRAMEFLOW_LIVE_VOICE=1.
// FRAMEFLOW_LIVE_HOME reutiliza una carpeta de datos (y el modelo ya descargado).
describe.skipIf(!process.env.FRAMEFLOW_LIVE_VOICE)("voz real con Kokoro en Node", () => {
	it("genera audio y tiempos por palabra en español", { timeout: 1_800_000 }, async () => {
		const dataDir = process.env.FRAMEFLOW_LIVE_HOME ?? mkdtempSync(join(tmpdir(), "ff-voice-"));
		const engine = createVoiceEngine({
			dataDir,
			espeakScript: join(import.meta.dirname, "../../espeak-process.ts"),
		});
		const outDir = join(dataDir, "out");
		const events: string[] = [];
		const items = [
			{ id: "s1", text: "¿Alguna vez te preguntaste por qué Marte parece un planeta rojo?" },
			{
				id: "s2",
				text: "Su superficie está cubierta de óxido de hierro, el mismo material que forma la herrumbre en la Tierra.",
			},
		];
		const started = performance.now();
		const results = await engine.synthesize(
			{ language: "es", voiceId: "em_alex", speed: 1, outDir, items },
			(e) => events.push(e.kind === "scene" ? `escena ${e.done}/${e.total}` : "descarga"),
		);
		console.log(
			`tiempo ${Math.round(performance.now() - started)} ms`,
			events.filter((e) => e !== "descarga"),
		);
		for (const r of results)
			console.log(r.id, r.file, r.duration, JSON.stringify(r.words.slice(0, 4)));
		expect(results.map((r) => r.id)).toEqual(["s1", "s2"]);
		expect(results[1]?.words).toHaveLength(items[1]?.text.split(" ").length ?? 0);
		expect(readFileSync(join(outDir, results[0]?.file ?? "")).length).toBeGreaterThan(44);
		// Segunda vez: todo reutilizado (sin cargar el modelo).
		const again = performance.now();
		await engine.synthesize(
			{ language: "es", voiceId: "em_alex", speed: 1, outDir, items },
			() => {},
		);
		expect(performance.now() - again).toBeLessThan(500);
	});
});

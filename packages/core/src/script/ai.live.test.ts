import { arch, platform, totalmem } from "node:os";
import { describe, expect, it } from "vitest";
import { defaultLocalModel, systemInfoFrom } from "../ai/catalog";
import { generateScript, OllamaProvider } from "./ai";
import { estimateSeconds } from "./script";

// Prueba contra un modelo real de Ollama. Solo corre con FRAMEFLOW_LIVE_AI=1 (tarda y necesita el modelo):
//   FRAMEFLOW_LIVE_AI=1 pnpm --filter @frameflow/core test ai.live
const live = process.env.FRAMEFLOW_LIVE_AI === "1";
// Por defecto, el modelo local recomendado para este equipo (como en la app).
const model =
	process.env.FRAMEFLOW_MODEL ??
	defaultLocalModel(systemInfoFrom({ platform: platform(), arch: arch(), totalBytes: totalmem() }));

describe.skipIf(!live)("guion con IA real", () => {
	it("escribe un guion válido de unos 45 s en español", { timeout: 900_000 }, async () => {
		const ollama = new OllamaProvider(model);
		expect(await ollama.status()).toMatchObject({ available: true });
		let attempts = 0;
		const llm = {
			name: ollama.name,
			generateJson: (...args: Parameters<OllamaProvider["generateJson"]>) => {
				attempts++;
				return ollama.generateJson(...args);
			},
		};

		const started = Date.now();
		const script = await generateScript(llm, {
			topic: process.env.FRAMEFLOW_LIVE_TOPIC ?? "Por qué Marte es rojo",
			tone: "Claro y riguroso pero divulgativo, con analogías cotidianas.",
			language: "es",
			seconds: 45,
			channel: "Astroinfo",
		});
		const seconds = script.scenes.reduce((t, s) => t + estimateSeconds(s.narration), 0);
		console.log(
			JSON.stringify(
				{ ms: Date.now() - started, attempts, estimatedSeconds: seconds, script },
				null,
				2,
			),
		);

		expect(script.scenes.length).toBeGreaterThanOrEqual(3);
		expect(seconds).toBeGreaterThan(20);
		expect(seconds).toBeLessThan(90);
		// Variedad: no todo cifras, y las cifras con un número y una explicación de verdad.
		expect(script.scenes.some((s) => s.content.type === "kinetic-text")).toBe(true);
		for (const scene of script.scenes) {
			expect(scene.narration.split(/\s+/).length).toBeGreaterThanOrEqual(5);
			expect(scene.narration).not.toMatch(/\d/);
			if (scene.content.type === "stat") {
				expect(scene.content.value).not.toBe(0);
				expect(scene.content.label).not.toMatch(/^(kinetic-text|stat|narration)$/);
			}
		}
	});
});

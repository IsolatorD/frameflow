import { arch, platform, totalmem } from "node:os";
import { describe, expect, it } from "vitest";
import { defaultLocalModel, systemInfoFrom } from "../ai/catalog";
import { OllamaProvider } from "./ai";
import { applySuggestion, canApply, reviewScript } from "./review";
import { type Script, scriptSchema } from "./script";

// «Revisar guion» contra un modelo real de Ollama. Solo con FRAMEFLOW_LIVE_AI=1:
//   FRAMEFLOW_LIVE_AI=1 pnpm --filter @frameflow/core exec vitest run review.live
const live = process.env.FRAMEFLOW_LIVE_AI === "1";
const model =
	process.env.FRAMEFLOW_MODEL ??
	defaultLocalModel(systemInfoFrom({ platform: platform(), arch: arch(), totalBytes: totalmem() }));

// Guion con fallos a propósito: el gancho promete "el secreto" y el cierre no lo da.
const flawed: Script = {
	title: "El secreto del color de Marte",
	scenes: [
		{
			narration: "Hoy te cuento el secreto de por qué Marte es rojo. Quédate hasta el final.",
			content: { type: "kinetic-text", lines: [{ text: "El secreto de Marte" }] },
		},
		{
			narration: "Marte es el cuarto planeta del sistema solar.",
			content: { type: "kinetic-text", lines: [{ text: "Cuarto planeta" }] },
		},
		{
			narration: "Tiene dos lunas pequeñas, Fobos y Deimos.",
			content: { type: "kinetic-text", lines: [{ text: "Fobos y Deimos" }] },
		},
		{
			narration: "Y eso es todo por hoy. Comenta qué planeta quieres ver.",
			content: { type: "kinetic-text", lines: [{ text: "¿Qué planeta?" }] },
		},
	],
};

describe.skipIf(!live)("revisar guion con IA real", () => {
	it("detecta la promesa incumplida y propone cambios aplicables", {
		timeout: 600_000,
	}, async () => {
		const llm = new OllamaProvider(model, process.env.OLLAMA_URL);
		expect(await llm.status()).toMatchObject({ available: true });
		const started = Date.now();
		const review = await reviewScript(llm, flawed, {
			topic: "Por qué Marte es rojo",
			tone: "Claro y divulgativo, con analogías cotidianas.",
			language: "es",
			channel: "Astroinfo",
		});
		console.log(JSON.stringify({ ms: Date.now() - started, review }, null, 2));
		expect(review.verdict.length).toBeGreaterThan(10);
		expect(review.suggestions.length).toBeGreaterThan(0);
		// Debería notar que el video no explica por qué Marte es rojo (promesa, cierre o progresión).
		expect(
			review.suggestions.some((s) =>
				["promesa", "cierre", "progresion", "gancho"].includes(s.aspect),
			),
		).toBe(true);
		// Toda propuesta aplicable deja un guion válido.
		for (const s of review.suggestions.filter(canApply))
			expect(() => scriptSchema.parse(applySuggestion(flawed, s))).not.toThrow();
	});
});

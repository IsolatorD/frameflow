import { appendFileSync } from "node:fs";
import { arch, platform, totalmem } from "node:os";
import { describe, expect, it } from "vitest";
import { defaultLocalModel, systemInfoFrom } from "../ai/catalog";
import { generateScriptWithStats, OllamaProvider, type ScriptQualityOptions } from "./ai";
import { qualityReport } from "./quality";

// Banco de evaluación del guion con el modelo real (opcional y lento). Cada ejecución prueba una
// variante sobre varios temas y añade una línea JSON por tema al archivo FRAMEFLOW_EVAL_OUT:
//   FRAMEFLOW_EVAL_OUT=/tmp/eval.jsonl FRAMEFLOW_EVAL_VARIANT='{"review":true}' \\
//     pnpm --filter @frameflow/core exec vitest run ai.eval
const out = process.env.FRAMEFLOW_EVAL_OUT;
// Por defecto, el modelo local recomendado para este equipo (como en la app).
const model =
	process.env.FRAMEFLOW_MODEL ??
	defaultLocalModel(systemInfoFrom({ platform: platform(), arch: arch(), totalBytes: totalmem() }));
const variant: ScriptQualityOptions = JSON.parse(process.env.FRAMEFLOW_EVAL_VARIANT ?? "{}");

export const EVAL_TOPICS = [
	"Por qué Marte es rojo",
	"Cuánto pesa una nube",
	"Qué es un agujero negro",
	"Por qué los gatos ronronean",
];

describe.skipIf(!out)("evaluación del guion con IA real", () => {
	it.each(EVAL_TOPICS)("%s", { timeout: 900_000 }, async (topic) => {
		const llm = new OllamaProvider(model);
		const started = Date.now();
		let error: string | null = null;
		let result: Awaited<ReturnType<typeof generateScriptWithStats>> | null = null;
		try {
			result = await generateScriptWithStats(llm, {
				topic,
				tone: "Claro y riguroso pero divulgativo, con analogías cotidianas.",
				language: "es",
				seconds: 45,
				channel: "Astroinfo",
				quality: variant,
			});
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
		appendFileSync(
			out as string,
			`${JSON.stringify({
				variant,
				topic,
				ms: Date.now() - started,
				error,
				calls: result?.calls ?? null,
				reviewed: result?.reviewed ?? null,
				softProblems: result?.softProblems ?? null,
				report: result ? qualityReport(result.script, 45) : null,
				script: result?.script ?? null,
			})}\n`,
		);
		expect(error).toBeNull();
	});
});

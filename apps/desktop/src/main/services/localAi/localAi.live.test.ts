import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LocalAiState } from "@frameflow/core/ai/localRuntime";
import { describe, expect, it } from "vitest";
import { createLocalAi } from "./localAi";

// Prueba real (lenta, descarga Ollama de GitHub): FRAMEFLOW_LIVE_RUNTIME=1.
// FRAMEFLOW_LIVE_HOME reutiliza una carpeta (la descarga se reanuda); el modelo a "descargar"
// debe estar ya en ~/.ollama para que el paso del modelo sea rápido.
describe.skipIf(!process.env.FRAMEFLOW_LIVE_RUNTIME)("IA local real", () => {
	it("descarga, verifica, arranca Ollama y prepara el modelo", { timeout: 3_600_000 }, async () => {
		const dataDir = process.env.FRAMEFLOW_LIVE_HOME ?? mkdtempSync(join(tmpdir(), "ff-runtime-"));
		let last = "";
		const done = new Promise<LocalAiState>((resolve) => {
			const localAi = createLocalAi({
				dataDir,
				ignoreSystem: true,
				emit: (state) => {
					const job = state.job;
					const line = job
						? `${job.step} ${job.status} ${job.progress ? `${Math.round((job.progress.done / (job.progress.total ?? 1)) * 100)}%` : ""} reintentos=${job.retries} ${job.error ?? ""}`
						: "sin trabajo";
					if (line !== last) console.log(new Date().toISOString().slice(11, 19), line);
					last = line;
					if (job && job.status !== "running") {
						localAi.stop(); // antes de terminar: si no, el `ollama serve` queda huérfano
						resolve(state);
					}
				},
			});
			localAi.prepare(
				process.env.FRAMEFLOW_MODEL ?? "hf.co/unsloth/Qwen3-8B-GGUF:Q4_K_M",
				Number(process.env.FRAMEFLOW_LIVE_MODEL_GB ?? 5),
			);
		});
		const state = await done;
		console.log(
			"estado final",
			JSON.stringify({ ...state, runtime: undefined }),
			"datos:",
			dataDir,
		);
		expect(state.job?.status).toBe("done");
		expect(state.engine).toBe("managed");
	});
});

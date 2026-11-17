import { modelLabel, PROVIDERS } from "@frameflow/core/ai/catalog";
import {
	formatBytes,
	type LocalAiState,
	type LocalJob,
	type LocalJobStep,
	requiredBytes,
} from "@frameflow/core/ai/localRuntime";
import type {
	AiPrepareJob,
	AiPrepareStep,
} from "@frameflow/ui/src/organisms/AiSettingsPanel/AiSettingsPanelInterface";

const ORDER: Record<LocalJobStep, number> = {
	space: 0,
	runtime: 1,
	verify: 2,
	extract: 2,
	start: 2,
	model: 3,
};

/** Tamaño de descarga de un modelo local conocido ("5 GB"). */
export const localModelSize = (id: string) => {
	const gb = PROVIDERS.ollama.models.find((m) => m.id === id)?.sizeGb;
	return gb ? `${gb} GB` : null;
};

const duration = (seconds: number) =>
	seconds < 90
		? "menos de 2 min"
		: seconds < 3600
			? `${Math.round(seconds / 60)} min`
			: `${(seconds / 3600).toLocaleString("es", { maximumFractionDigits: 1 })} h`;

/** "1,2 GB de 5 GB · 3,4 MB/s · quedan 20 min" */
function progressDetail(job: LocalJob): string | undefined {
	if (!job.progress) return undefined;
	const { done, total } = job.progress;
	const parts = [total ? `${formatBytes(done)} de ${formatBytes(total)}` : formatBytes(done)];
	if (job.speed && job.speed > 0) {
		parts.push(`${formatBytes(job.speed)}/s`);
		if (total) parts.push(`quedan ${duration((total - done) / job.speed)}`);
	}
	return parts.join(" · ");
}

/** Traduce el trabajo del proceso principal a los pasos que muestra la pantalla. */
export function toPrepareJob(job: LocalJob, runtimeSize: string | null): AiPrepareJob {
	const label = modelLabel("ollama", job.model);
	const current = job.status === "done" ? 99 : ORDER[job.step];
	const fraction = job.progress?.total
		? Math.min(1, job.progress.done / job.progress.total)
		: undefined;
	const step = (id: string, text: string, at: number): AiPrepareStep => {
		const state = current > at ? "done" : current === at ? "active" : "pending";
		const active = state === "active";
		const download = id === "runtime" || id === "model";
		return {
			id,
			label: text,
			state,
			fraction: active && download ? fraction : undefined,
			detail: active && download ? progressDetail(job) : undefined,
		};
	};
	const steps = [
		...(job.includesRuntime
			? [
					step("runtime", `Descargar Ollama${runtimeSize ? ` (${runtimeSize})` : ""}`, 1),
					step("prepare", "Verificar y poner en marcha Ollama", 2),
				]
			: []),
		step("model", `Descargar ${label}`, 3),
	];
	return {
		modelLabel: label,
		steps,
		status: job.status,
		error: job.error,
		notice:
			job.retries > 0
				? `Se cortó la conexión; reintentando (${job.retries})… lo descargado se conserva.`
				: undefined,
	};
}

/** Aviso previo si no cabe la descarga (el proceso principal vuelve a comprobarlo al empezar). */
export function spaceWarning(local: LocalAiState, id: string): string | null {
	if (local.freeBytes === null) return null;
	const gb = local.modelsOnDisk.includes(id)
		? 0
		: (PROVIDERS.ollama.models.find((m) => m.id === id)?.sizeGb ?? null);
	const needed = requiredBytes({
		runtime: local.engine === "missing" ? local.runtime : null,
		modelGb: gb,
	});
	if (local.freeBytes >= needed) return null;
	return `Hacen falta unos ${formatBytes(needed)} libres y quedan ${formatBytes(local.freeBytes)}. Libera espacio antes de descargar.`;
}

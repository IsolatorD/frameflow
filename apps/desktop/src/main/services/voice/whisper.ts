import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Progress } from "@frameflow/core/ai/localRuntime";
import type { HeardWord } from "@frameflow/core/voice/recording";
import {
	WHISPER_FILES,
	WHISPER_REPO,
	WHISPER_REVISION,
	whisperLanguage,
	whisperUrl,
} from "@frameflow/core/voice/whisperModel";
import { ensureVerifiedFile } from "../download";

// Whisper con transformers.js (ONNX Runtime) para saber cuándo se dice cada palabra en una voz
// GRABADA. El modelo (~77 MB) se descarga la primera vez a <datos>/models/whisper-<revisión>/ y se
// verifica con SHA-256; después transformers.js lo lee de ahí, sin red.

type Asr = (
	audio: Float32Array,
	options: Record<string, unknown>,
) => Promise<{ text: string; chunks?: { text: string; timestamp: [number, number | null] }[] }>;

export type Whisper = ReturnType<typeof createWhisper>;

export function createWhisper(opts: { dataDir: string }) {
	const root = join(opts.dataDir, "models", `whisper-${WHISPER_REVISION.slice(0, 8)}`);
	let loading: Promise<Asr> | null = null;

	async function ensureModel(signal?: AbortSignal, onProgress?: (p: Progress) => void) {
		const total = WHISPER_FILES.reduce((n, f) => n + f.sizeBytes, 0);
		let doneBefore = 0;
		for (const f of WHISPER_FILES) {
			await ensureVerifiedFile({
				url: whisperUrl(f.file),
				dest: join(root, WHISPER_REPO, f.file),
				sha256: f.sha256,
				signal,
				onProgress: (p) => onProgress?.({ done: doneBefore + p.done, total }),
			});
			doneBefore += f.sizeBytes;
		}
	}

	async function load(): Promise<Asr> {
		loading ??= (async () => {
			const { pipeline, env } = await import("@huggingface/transformers");
			env.localModelPath = root;
			env.allowRemoteModels = false;
			env.allowLocalModels = true;
			const asr = await pipeline("automatic-speech-recognition", WHISPER_REPO, {
				dtype: { encoder_model: "q8", decoder_model_merged: "q8" },
				device: "cpu",
			});
			return asr as unknown as Asr;
		})().catch((error) => {
			loading = null;
			throw error;
		});
		return loading;
	}

	return {
		/** ¿Ya está descargado? (para avisar de la descarga antes de empezar) */
		modelReady: () =>
			WHISPER_FILES.every((f) => existsSync(`${join(root, WHISPER_REPO, f.file)}.ok`)),
		ensureModel,
		/** Palabras que oye en el audio (16 kHz mono) con sus tiempos en segundos. */
		async transcribe(pcm16k: Float32Array, language: string): Promise<HeardWord[]> {
			const asr = await load();
			const result = await asr(pcm16k, {
				language: whisperLanguage(language),
				task: "transcribe",
				return_timestamps: "word",
				chunk_length_s: 30,
			});
			return (result.chunks ?? []).map((c) => ({
				text: c.text.trim(),
				start: c.timestamp[0],
				end: c.timestamp[1] ?? c.timestamp[0],
			}));
		},
	};
}

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Progress } from "@frameflow/core/ai/localRuntime";
import {
	DEFAULT_KOKORO_VARIANT,
	KOKORO_MAX_PHONEMES,
	KOKORO_MODELS,
	KOKORO_REVISION,
	KOKORO_SAMPLE_RATE,
	KOKORO_VOICES,
	type KokoroVariant,
	kokoroUrl,
} from "@frameflow/core/voice/kokoroModel";
import { espeakChunks, espeakLanguage, fromEspeak } from "@frameflow/core/voice/phonemes";
import {
	silences,
	snapToSilences,
	splitForModel,
	tokenize,
	type WordTiming,
	wordTimings,
} from "@frameflow/core/voice/timing";
import ort from "onnxruntime-node";
import { downloadFile, sha256 } from "../download";
import { type EspeakClient, startEspeak } from "./espeak";

// Voz con Kokoro-82M (Apache-2.0) en Node: eSpeak NG (WebAssembly) pasa el texto a fonemas,
// ONNX Runtime genera el audio y la duración de cada fonema, y de ahí salen los tiempos por
// palabra. Sustituye al servicio de Python (Kokoro + Whisper): mismo resultado, sin instalar nada.
//
// El modelo (y cada voz) se descarga la primera vez a <datos>/models/kokoro-<revisión>/ y se
// verifica con SHA-256. Los audios se nombran con un hash de voz+velocidad+texto (igual que antes):
// si no cambian, se reutilizan.

export type TtsRequest = {
	language: string;
	voiceId: string;
	speed: number;
	outDir: string;
	items: { id: string; text: string }[];
};

export type TtsResult = {
	id: string;
	file: string;
	duration: number;
	words: WordTiming[];
};

export type VoiceProgress =
	| { kind: "download"; progress: Progress }
	| { kind: "scene"; done: number; total: number };

export type VoiceEngine = ReturnType<typeof createVoiceEngine>;

export function createVoiceEngine(opts: {
	dataDir: string;
	/** Script del proceso de eSpeak (espeak-process.js junto al proceso principal compilado). */
	espeakScript: string;
	variant?: KokoroVariant;
}) {
	const variant = opts.variant ?? DEFAULT_KOKORO_VARIANT;
	const modelDir = join(opts.dataDir, "models", `kokoro-${KOKORO_REVISION.slice(0, 8)}`);

	/** Descarga (si falta) y verifica un archivo del modelo. Un ".ok" recuerda que ya se verificó. */
	async function ensureFile(
		file: string,
		expected: string,
		signal: AbortSignal | undefined,
		onProgress?: (p: Progress) => void,
	) {
		const dest = join(modelDir, file);
		const ok = `${dest}.ok`;
		if (existsSync(dest) && existsSync(ok) && readFileSync(ok, "utf8").trim() === expected)
			return dest;
		mkdirSync(join(dest, ".."), { recursive: true });
		const controller = signal ?? new AbortController().signal;
		for (let attempt = 1; ; attempt++) {
			try {
				await downloadFile(kokoroUrl(file), dest, {
					signal: controller,
					onProgress: (p) => onProgress?.(p),
				});
				break;
			} catch (error) {
				if (controller.aborted || attempt >= 5 || !(error instanceof TypeError)) throw error;
				await new Promise((r) => setTimeout(r, 3000));
			}
		}
		if ((await sha256(dest)) !== expected) {
			rmSync(dest, { force: true });
			throw new Error(`La descarga de ${file} está dañada (se ha borrado). Vuelve a intentarlo.`);
		}
		writeFileSync(ok, `${expected}\n`);
		return dest;
	}

	async function loadVoice(voiceId: string, signal?: AbortSignal): Promise<Float32Array> {
		const expected = KOKORO_VOICES[voiceId];
		if (!expected) throw new Error(`La voz "${voiceId}" no existe en Kokoro.`);
		const path = await ensureFile(`voices/${voiceId}.bin`, expected, signal);
		const bytes = readFileSync(path);
		return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
	}

	/** Fonemas de un texto: eSpeak (en su proceso) + las reglas de misaki. */
	async function phonemesOf(text: string, language: string, espeak: EspeakClient) {
		const { chunks, marks } = espeakChunks(text);
		return fromEspeak(await espeak.phonemize(chunks, language), marks, language);
	}

	/** Trozos que quepan en el modelo: por frases y, si hace falta, por mitades. */
	async function modelChunks(text: string, language: string, espeak: EspeakClient) {
		// Primero por longitud del texto (los fonemas ocupan algo más que las letras)…
		const pieces = splitForModel(text, CHARS_PER_CALL, (c) => c.length);
		const out: { text: string; phonemes: string }[] = [];
		const add = async (piece: string): Promise<void> => {
			const phonemes = await phonemesOf(piece, language, espeak);
			const words = piece.split(/\s+/);
			if (phonemes.length <= KOKORO_MAX_PHONEMES || words.length < 2) {
				out.push({ text: piece, phonemes: phonemes.slice(0, KOKORO_MAX_PHONEMES) });
				return;
			}
			// …y si aún no cabe, por la mitad.
			const half = Math.ceil(words.length / 2);
			await add(words.slice(0, half).join(" "));
			await add(words.slice(half).join(" "));
		};
		for (const piece of pieces) await add(piece);
		return out;
	}

	async function synthesizeText(
		session: ort.InferenceSession,
		text: string,
		language: string,
		voice: Float32Array,
		speed: number,
		espeak: EspeakClient,
	): Promise<{ audio: Float32Array; words: WordTiming[] }> {
		const parts: Float32Array[] = [];
		const words: WordTiming[] = [];
		let offset = 0;
		for (const chunk of await modelChunks(text, language, espeak)) {
			const { ids, symbols } = tokenize(chunk.phonemes);
			// Estilo de la voz según la longitud (como Python: pack[len(ps) - 1]).
			const row = Math.min(Math.max(chunk.phonemes.length - 1, 0), 509);
			const out = await session.run({
				input_ids: new ort.Tensor("int64", BigInt64Array.from([0, ...ids, 0], BigInt), [
					1,
					ids.length + 2,
				]),
				style: new ort.Tensor("float32", voice.slice(row * 256, row * 256 + 256), [1, 256]),
				speed: new ort.Tensor("float32", Float32Array.from([speed]), [1]),
			});
			const audio = out.waveform?.data as Float32Array;
			const durations = Array.from(out.durations?.data as ArrayLike<number>, Number);
			const seconds = audio.length / KOKORO_SAMPLE_RATE;
			const timed = snapToSilences(
				wordTimings(chunk.text, symbols, durations, seconds),
				silences(audio, KOKORO_SAMPLE_RATE),
				seconds,
			);
			words.push(...timed.map((w) => shift(w, offset)));
			parts.push(audio);
			offset += seconds;
		}
		return { audio: concat(parts), words };
	}

	return {
		/** ¿Ya está descargado el modelo? (para avisar de la descarga antes de empezar) */
		modelReady: () => {
			const model = KOKORO_MODELS[variant];
			const path = join(modelDir, model.file);
			return existsSync(path) && existsSync(`${path}.ok`);
		},
		modelSizeBytes: () => KOKORO_MODELS[variant].sizeBytes,

		async synthesize(
			request: TtsRequest,
			onProgress: (event: VoiceProgress) => void,
			signal?: AbortSignal,
		): Promise<TtsResult[]> {
			mkdirSync(request.outDir, { recursive: true });
			const pending = request.items.map((item) => {
				const text = item.text.trim();
				const key = createHash("sha1")
					.update(`${request.voiceId}|${formatSpeed(request.speed)}|${text}`)
					.digest("hex")
					.slice(0, 12);
				const wav = join(request.outDir, `${key}.wav`);
				return { ...item, text, wav, wordsFile: wav.replace(/\.wav$/, ".words.json") };
			});
			const needsWork = pending.some((p) => !existsSync(p.wav) || !existsSync(p.wordsFile));

			let session: ort.InferenceSession | null = null;
			let voice: Float32Array | null = null;
			let espeak: EspeakClient | null = null;
			const language = espeakLanguage(request.language, request.voiceId);
			try {
				if (needsWork) {
					const model = KOKORO_MODELS[variant];
					const modelPath = await ensureFile(model.file, model.sha256, signal, (progress) =>
						onProgress({ kind: "download", progress }),
					);
					voice = await loadVoice(request.voiceId, signal);
					espeak = startEspeak(opts.espeakScript);
					session = await ort.InferenceSession.create(modelPath, {
						executionProviders: ["cpu"],
					});
				}
				const results: TtsResult[] = [];
				for (const [index, item] of pending.entries()) {
					signal?.throwIfAborted();
					if (!existsSync(item.wav) || !existsSync(item.wordsFile)) {
						const { audio, words } = await synthesizeText(
							session as ort.InferenceSession,
							item.text,
							language,
							voice as Float32Array,
							request.speed,
							espeak as EspeakClient,
						);
						writeFileSync(item.wav, encodeWav(audio, KOKORO_SAMPLE_RATE));
						writeFileSync(item.wordsFile, JSON.stringify(words));
					}
					results.push({
						id: item.id,
						file: item.wav.split(/[\\/]/).pop() as string,
						duration: Math.round(wavSeconds(item.wav) * 1000) / 1000,
						words: JSON.parse(readFileSync(item.wordsFile, "utf8")),
					});
					onProgress({ kind: "scene", done: index + 1, total: pending.length });
				}
				return results;
			} finally {
				// El modelo ocupa varios cientos de MB en memoria: se libera al terminar.
				await session?.release();
				espeak?.close();
			}
		},
	};
}

/** Letras por llamada al modelo antes de comprobar con los fonemas (≈ 80 % del máximo). */
const CHARS_PER_CALL = 400;

/** Igual que Python al formar la clave del archivo: 1.0 → "1.0". */
const formatSpeed = (speed: number) => (Number.isInteger(speed) ? speed.toFixed(1) : String(speed));

const shift = (w: WordTiming, offset: number): WordTiming =>
	offset === 0
		? w
		: {
				text: w.text,
				start: Math.round((w.start + offset) * 1000) / 1000,
				end: Math.round((w.end + offset) * 1000) / 1000,
			};

function concat(parts: Float32Array[]): Float32Array {
	const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
	let at = 0;
	for (const part of parts) {
		out.set(part, at);
		at += part.length;
	}
	return out;
}

/** WAV PCM 16 bits mono (lo mismo que escribía soundfile en Python). */
export function encodeWav(audio: Float32Array, sampleRate: number): Buffer {
	const pcm = Buffer.alloc(audio.length * 2);
	for (let i = 0; i < audio.length; i++) {
		const v = Math.max(-1, Math.min(1, audio[i] as number));
		pcm.writeInt16LE(Math.round(v < 0 ? v * 32768 : v * 32767), i * 2);
	}
	const header = Buffer.alloc(44);
	header.write("RIFF", 0);
	header.writeUInt32LE(36 + pcm.length, 4);
	header.write("WAVE", 8);
	header.write("fmt ", 12);
	header.writeUInt32LE(16, 16);
	header.writeUInt16LE(1, 20);
	header.writeUInt16LE(1, 22);
	header.writeUInt32LE(sampleRate, 24);
	header.writeUInt32LE(sampleRate * 2, 28);
	header.writeUInt16LE(2, 32);
	header.writeUInt16LE(16, 34);
	header.write("data", 36);
	header.writeUInt32LE(pcm.length, 40);
	return Buffer.concat([header, pcm]);
}

/** Duración de un WAV (también de los que generaba Python, por si cambia la cabecera). */
function wavSeconds(path: string): number {
	const buf = readFileSync(path);
	let pos = 12;
	let rate = KOKORO_SAMPLE_RATE;
	let blockAlign = 2;
	while (pos + 8 <= buf.length) {
		const id = buf.toString("ascii", pos, pos + 4);
		const size = buf.readUInt32LE(pos + 4);
		if (id === "fmt ") {
			rate = buf.readUInt32LE(pos + 12);
			blockAlign = buf.readUInt16LE(pos + 20);
		} else if (id === "data") {
			return Math.min(size, buf.length - pos - 8) / blockAlign / rate;
		}
		pos += 8 + size + (size % 2);
	}
	return 0;
}

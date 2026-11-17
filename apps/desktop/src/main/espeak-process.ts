// Proceso aparte para eSpeak NG (GPL-3.0): recibe textos por la entrada estándar y devuelve sus
// fonemas por la salida, una línea JSON por petición. Va en su propio proceso, como antes el
// servicio de Python, para que eSpeak sea un programa separado de la app y no una parte de ella.
//
//   → {"id": 1, "language": "es", "chunks": ["Hola", "mundo"]}
//   ← {"id": 1, "phonemes": ["o_l_a", "m_ˈu_n_d_o"]}   o   {"id": 1, "error": "..."}
import { createInterface } from "node:readline";
import EspeakModule from "@echogarden/espeak-ng-emscripten";

type Worker = {
	set_voice(name: string, lang: string): void;
	text_to_phonemes(text: string, useIpa: boolean): unknown;
};
type Module = {
	eSpeakNGWorker: new () => Worker;
	getPointer(ptr: unknown): number;
	HEAPU8: Uint8Array;
};

const module = (await (EspeakModule as unknown as () => Promise<Module>)()) as Module;
const worker = new module.eSpeakNGWorker();
let voice = "";
const decoder = new TextDecoder();

function phonemize(chunk: string, language: string): string {
	if (voice !== language) {
		worker.set_voice(language, language);
		voice = language;
	}
	const address = module.getPointer(worker.text_to_phonemes(chunk, true));
	const heap = module.HEAPU8;
	let end = address;
	while (heap[end] !== 0) end++;
	return decoder.decode(heap.subarray(address, end));
}

for await (const line of createInterface({ input: process.stdin })) {
	if (!line.trim()) continue;
	let id: unknown = null;
	try {
		const request = JSON.parse(line) as { id: unknown; language: string; chunks: string[] };
		id = request.id;
		const phonemes = request.chunks.map((c) => (c.trim() ? phonemize(c, request.language) : ""));
		process.stdout.write(`${JSON.stringify({ id, phonemes })}\n`);
	} catch (error) {
		process.stdout.write(`${JSON.stringify({ id, error: String(error) })}\n`);
	}
}

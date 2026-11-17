import { type ChildProcess, fork } from "node:child_process";
import { createInterface } from "node:readline";

// Cliente del proceso de eSpeak NG (ver ../../espeak-process.ts): lo arranca al empezar una tanda
// de voces y lo cierra al terminar. Cargar eSpeak tarda ~1 s; cada petición, milisegundos.

export type EspeakClient = {
	/** Fonemas en bruto (separados por "_") de cada trozo de texto sin puntuación. */
	phonemize(chunks: string[], language: string): Promise<string[]>;
	close(): void;
};

export function startEspeak(scriptPath: string): EspeakClient {
	const child: ChildProcess = fork(scriptPath, [], {
		stdio: ["pipe", "pipe", "pipe", "ipc"],
		env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
	});
	const pending = new Map<number, { resolve: (p: string[]) => void; reject: (e: Error) => void }>();
	let nextId = 1;
	let stderr = "";
	let exited: Error | null = null;
	child.stderr?.on("data", (chunk: Buffer) => {
		stderr = (stderr + chunk.toString()).slice(-2000);
	});
	const fail = (error: Error) => {
		exited = error;
		for (const { reject } of pending.values()) reject(error);
		pending.clear();
	};
	child.on("error", (error) => fail(new Error(`No se pudo arrancar eSpeak: ${error.message}`)));
	child.on("exit", (code) => {
		if (code !== 0 && code !== null)
			fail(new Error(`eSpeak se cerró (código ${code}): ${stderr.trim()}`));
		else fail(new Error("eSpeak se cerró."));
	});
	createInterface({ input: child.stdout as NodeJS.ReadableStream }).on("line", (line) => {
		if (!line.trim().startsWith("{")) return;
		const reply = JSON.parse(line) as { id: number; phonemes?: string[]; error?: string };
		const waiter = pending.get(reply.id);
		if (!waiter) return;
		pending.delete(reply.id);
		if (reply.phonemes) waiter.resolve(reply.phonemes);
		else waiter.reject(new Error(`eSpeak: ${reply.error ?? "respuesta vacía"}`));
	});
	return {
		phonemize(chunks, language) {
			if (exited) return Promise.reject(exited);
			const id = nextId++;
			return new Promise((resolve, reject) => {
				pending.set(id, { resolve, reject });
				child.stdin?.write(`${JSON.stringify({ id, language, chunks })}\n`);
			});
		},
		close() {
			child.stdin?.end();
			if (child.exitCode === null) child.kill();
		},
	};
}

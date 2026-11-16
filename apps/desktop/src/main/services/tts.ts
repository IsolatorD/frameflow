import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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
	words: { text: string; start: number; end: number }[];
};

// Al abrir la app desde el Finder el PATH es mínimo: se añaden las rutas habituales de Homebrew/uv.
const EXTRA_PATHS = [
	"/opt/homebrew/bin",
	"/usr/local/bin",
	join(homedir(), ".local/bin"),
	join(homedir(), ".cargo/bin"),
];

const findUv = (): string =>
	EXTRA_PATHS.map((dir) => join(dir, "uv")).find((p) => existsSync(p)) ?? "uv";

/**
 * Genera las voces con el servicio Python (packages/tts): Kokoro + Whisper.
 * La primera vez uv instala el entorno y Kokoro descarga el modelo: puede tardar varios minutos.
 */
export function synthesize(
	ttsDir: string,
	request: TtsRequest,
	onProgress: (done: number, total: number) => void,
	signal?: AbortSignal,
): Promise<TtsResult[]> {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(
			findUv(),
			["run", "--project", ttsDir, "python", join(ttsDir, "synthesize.py")],
			{
				cwd: ttsDir,
				env: { ...process.env, PATH: [...EXTRA_PATHS, process.env.PATH].join(":") },
				signal,
			},
		);
		let buffer = "";
		let result: TtsResult[] | null = null;
		let failure: string | null = null;
		const stderr: string[] = [];

		child.stdout.on("data", (chunk: Buffer) => {
			buffer += chunk.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";
			for (const line of lines) {
				if (!line.trim().startsWith("{")) continue;
				const event = JSON.parse(line) as
					| { type: "progress"; done: number; total: number }
					| { type: "result"; items: TtsResult[] }
					| { type: "error"; message: string };
				if (event.type === "progress") onProgress(event.done, event.total);
				else if (event.type === "result") result = event.items;
				else failure = event.message;
			}
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderr.push(chunk.toString());
			if (stderr.length > 50) stderr.shift();
		});
		child.on("error", (error) =>
			reject(
				(error as NodeJS.ErrnoException).code === "ENOENT"
					? new Error("No se encontró `uv`. Instálalo con: brew install uv")
					: error,
			),
		);
		child.on("close", (code) => {
			if (result) resolvePromise(result);
			else
				reject(
					new Error(
						failure ??
							`El servicio de voz terminó con código ${code}: ${stderr.join("").slice(-500)}`,
					),
				);
		});
		child.stdin.end(JSON.stringify(request));
	});
}

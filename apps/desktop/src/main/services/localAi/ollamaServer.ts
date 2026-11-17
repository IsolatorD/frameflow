import { type ChildProcess, spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { MANAGED_OLLAMA_PORT } from "@frameflow/core/ai/localRuntime";

// Arranque y parada de `ollama serve` cuando lo gestiona la app (el descargado o uno del sistema
// que estaba cerrado). Escucha solo en 127.0.0.1 y en un puerto propio; se cierra al salir.

export const MANAGED_URL = `http://127.0.0.1:${MANAGED_OLLAMA_PORT}`;

/** ¿Responde Ollama en esa URL? */
export async function isUp(url: string, timeoutMs = 1500): Promise<boolean> {
	try {
		const res = await fetch(`${url}/api/version`, { signal: AbortSignal.timeout(timeoutMs) });
		return res.ok;
	} catch {
		return false;
	}
}

/** Ollama instalado por el usuario aunque esté cerrado (rutas habituales de cada sistema). */
export function systemBinary(): string | null {
	const home = homedir();
	const candidates =
		process.platform === "darwin"
			? [
					"/Applications/Ollama.app/Contents/Resources/ollama",
					join(home, "Applications/Ollama.app/Contents/Resources/ollama"),
					"/opt/homebrew/bin/ollama",
					"/usr/local/bin/ollama",
				]
			: process.platform === "win32"
				? [
						join(
							process.env.LOCALAPPDATA ?? join(home, "AppData/Local"),
							"Programs/Ollama/ollama.exe",
						),
					]
				: ["/usr/local/bin/ollama", "/usr/bin/ollama", join(home, ".local/bin/ollama")];
	return candidates.find((p) => existsSync(p)) ?? null;
}

export class OllamaServer {
	private child: ChildProcess | null = null;
	private binary: string | null = null;

	constructor(private readonly logDir: string) {}

	get running() {
		return this.child !== null && this.child.exitCode === null;
	}

	/** Arranca `binary serve` y espera a que responda (o falla con un mensaje claro). */
	async start(binary: string, timeoutMs = 30_000): Promise<string> {
		if (this.running && this.binary === binary && (await isUp(MANAGED_URL))) return MANAGED_URL;
		this.stop();
		// Uno de una sesión anterior que quedó vivo (la app se cerró de golpe): se reutiliza.
		if (await isUp(MANAGED_URL)) return MANAGED_URL;
		mkdirSync(this.logDir, { recursive: true });
		const log = createWriteStream(join(this.logDir, "ollama-serve.log"), { flags: "a" });
		const child = spawn(binary, ["serve"], {
			env: { ...process.env, OLLAMA_HOST: `127.0.0.1:${MANAGED_OLLAMA_PORT}` },
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true,
		});
		child.stdout?.pipe(log);
		child.stderr?.pipe(log);
		this.child = child;
		this.binary = binary;
		let exited: string | null = null;
		child.on("exit", (code) => {
			exited = `Ollama se cerró al arrancar (código ${code}). Detalles en ${join(this.logDir, "ollama-serve.log")}.`;
			if (this.child === child) this.child = null;
		});
		child.on("error", (error) => {
			exited = `No se pudo arrancar Ollama: ${error.message}`;
		});
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			if (exited) throw new Error(exited);
			if (await isUp(MANAGED_URL, 1000)) return MANAGED_URL;
			await new Promise((r) => setTimeout(r, 300));
		}
		this.stop();
		throw new Error("Ollama no respondió a tiempo al arrancar.");
	}

	stop() {
		if (this.child && this.child.exitCode === null) this.child.kill();
		this.child = null;
	}
}

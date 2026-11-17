import { spawn } from "node:child_process";
import {
	createReadStream,
	existsSync,
	mkdirSync,
	readdirSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip, createZstdDecompress } from "node:zlib";
import {
	checksumFor,
	OLLAMA_VERSION,
	type RuntimeAsset,
	releaseUrl,
} from "@frameflow/core/ai/localRuntime";
import { extract } from "tar";
import { downloadFile, sha256 } from "../download";

export { downloadFile, sha256 };

// Descarga, verificación y extracción del Ollama oficial dentro de la carpeta de datos:
//   <datos>/runtime/ollama-<versión>/   (lo extraído; ".complete" marca que terminó bien)
//   <datos>/runtime/downloads/           (descarga a medias: se reanuda)

const COMPLETE = ".complete";

export const runtimeDir = (dataDir: string) => join(dataDir, "runtime");
const installDir = (dataDir: string) => join(runtimeDir(dataDir), `ollama-${OLLAMA_VERSION}`);

/** Ejecutable de Ollama ya instalado por la app, o null. */
export function installedBinary(dataDir: string): string | null {
	const dir = installDir(dataDir);
	if (!existsSync(join(dir, COMPLETE))) return null;
	return findBinary(dir);
}

/** Busca `ollama` / `ollama.exe` dentro de lo extraído (la estructura cambia entre sistemas). */
function findBinary(dir: string, depth = 0): string | null {
	const name = process.platform === "win32" ? "ollama.exe" : "ollama";
	const direct = [join(dir, name), join(dir, "bin", name)].find(
		(p) => existsSync(p) && statSync(p).isFile(),
	);
	if (direct) return direct;
	if (depth > 3) return null;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const found = findBinary(join(dir, entry.name), depth + 1);
		if (found) return found;
	}
	return null;
}

/** Hash oficial del paquete, leído del `sha256sum.txt` de la misma release. */
export async function officialChecksum(asset: RuntimeAsset, signal: AbortSignal) {
	const res = await fetch(releaseUrl("sha256sum.txt"), { signal });
	if (!res.ok) throw new Error(`No se pudo leer la suma de verificación (${res.status}).`);
	const hash = checksumFor(await res.text(), asset.name);
	if (!hash) throw new Error(`La release ${OLLAMA_VERSION} no publica el hash de ${asset.name}.`);
	return hash;
}

/** Extrae el paquete en una carpeta temporal y la mueve a su sitio al terminar. */
export async function extractRuntime(dataDir: string, archive: string, asset: RuntimeAsset) {
	const target = installDir(dataDir);
	const temp = `${target}.tmp`;
	rmSync(temp, { recursive: true, force: true });
	mkdirSync(temp, { recursive: true });
	if (asset.format === "zip") {
		// Windows 10+ trae tar.exe (bsdtar), que abre .zip.
		await run("tar", ["-xf", archive, "-C", temp]);
	} else {
		const decompress = asset.format === "tgz" ? createGunzip() : createZstdDecompress();
		await pipeline(createReadStream(archive), decompress, extract({ cwd: temp }));
	}
	if (!findBinary(temp)) throw new Error("El paquete de Ollama no contiene el ejecutable.");
	writeFileSync(join(temp, COMPLETE), `${OLLAMA_VERSION}\n`);
	rmSync(target, { recursive: true, force: true });
	renameSync(temp, target);
	rmSync(archive, { force: true });
}

/** Borra versiones antiguas del runtime y descargas huérfanas (tras actualizar la versión fijada). */
export function cleanOldRuntimes(dataDir: string) {
	const dir = runtimeDir(dataDir);
	if (!existsSync(dir)) return;
	for (const entry of readdirSync(dir)) {
		if (entry.startsWith("ollama-") && entry !== `ollama-${OLLAMA_VERSION}`)
			rmSync(join(dir, entry), { recursive: true, force: true });
	}
}

function run(command: string, args: string[]) {
	return new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, { stdio: "ignore", windowsHide: true });
		child.on("error", reject);
		child.on("exit", (code) =>
			code === 0 ? resolve() : reject(new Error(`${command} terminó con código ${code}`)),
		);
	});
}

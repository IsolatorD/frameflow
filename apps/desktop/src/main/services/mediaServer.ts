import { randomBytes } from "node:crypto";
import { createReadStream, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, resolve, sep } from "node:path";

const TYPES: Record<string, string> = {
	".wav": "audio/wav",
	".mp3": "audio/mpeg",
	".m4a": "audio/mp4",
	".mp4": "video/mp4",
	".webm": "video/webm",
	".mov": "video/quicktime",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".json": "application/json",
};

export type MediaServer = { baseUrl: string; close(): Promise<void> };

/**
 * Servidor HTTP local (solo 127.0.0.1) que sirve los archivos de los proyectos a la vista previa
 * y al render de Remotion (que corre en otro Chrome y no puede leer rutas locales).
 * Un token aleatorio en la ruta impide que otras apps del equipo adivinen las URLs.
 * Admite peticiones Range, necesarias para avanzar/retroceder audio y video.
 */
export async function startMediaServer(root: string): Promise<MediaServer> {
	const token = randomBytes(16).toString("hex");
	const rootDir = resolve(root);

	const server: Server = createServer((req, res) => {
		res.setHeader("Access-Control-Allow-Origin", "*");
		const url = new URL(req.url ?? "/", "http://localhost");
		const [, first, ...rest] = url.pathname.split("/");
		if (first !== token || req.method !== "GET") {
			res.writeHead(404).end();
			return;
		}
		const file = resolve(rootDir, ...rest.map(decodeURIComponent));
		if (!file.startsWith(rootDir + sep)) {
			res.writeHead(403).end();
			return;
		}
		let size: number;
		try {
			const stat = statSync(file);
			if (!stat.isFile()) throw new Error("no es archivo");
			size = stat.size;
		} catch {
			res.writeHead(404).end();
			return;
		}
		const type = TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
		const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
		if (range) {
			const start = range[1] ? Number(range[1]) : size - Number(range[2]);
			const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
			if (start > end || start < 0) {
				res.writeHead(416, { "Content-Range": `bytes */${size}` }).end();
				return;
			}
			res.writeHead(206, {
				"Content-Type": type,
				"Content-Length": end - start + 1,
				"Content-Range": `bytes ${start}-${end}/${size}`,
				"Accept-Ranges": "bytes",
			});
			createReadStream(file, { start, end }).pipe(res);
			return;
		}
		res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes" });
		createReadStream(file).pipe(res);
	});

	await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
	const { port } = server.address() as AddressInfo;
	return {
		baseUrl: `http://127.0.0.1:${port}/${token}`,
		close: () => new Promise((ok) => server.close(() => ok())),
	};
}

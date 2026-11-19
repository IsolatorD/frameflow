import {
	extractPalette,
	type Swatch,
	type ThemeProposal,
	themeFromPalette,
} from "@frameflow/core/look/palette";

// Colores de una imagen o un video de referencia, leídos aquí mismo (nada sale del equipo): la
// imagen se reduce a ~200 px; del video se toman 8 fotogramas repartidos (sin el 5 % del principio
// ni del final, donde suele haber negro o rótulos).

const SIZE = 200;
const FRAMES = 8;

function draw(source: CanvasImageSource, w: number, h: number) {
	const scale = Math.min(1, SIZE / Math.max(w, h));
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(w * scale));
	canvas.height = Math.max(1, Math.round(h * scale));
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) throw new Error("No se pudo leer la referencia.");
	ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
	return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}

async function imagePixels(file: File) {
	const bitmap = await createImageBitmap(file).catch(() => {
		throw new Error("No se pudo abrir la imagen.");
	});
	try {
		return draw(bitmap, bitmap.width, bitmap.height);
	} finally {
		bitmap.close();
	}
}

async function videoPixels(file: File) {
	const url = URL.createObjectURL(file);
	const video = document.createElement("video");
	video.muted = true;
	video.preload = "auto";
	video.src = url;
	try {
		await new Promise<void>((resolve, reject) => {
			video.onloadeddata = () => resolve();
			video.onerror = () => reject(new Error("No se pudo abrir el video."));
		});
		const duration = Number.isFinite(video.duration) ? video.duration : 0;
		const chunks: Uint8ClampedArray[] = [];
		for (let i = 0; i < FRAMES; i++) {
			const t = duration * (0.05 + (0.9 * (i + 0.5)) / FRAMES);
			await new Promise<void>((resolve) => {
				video.onseeked = () => resolve();
				video.currentTime = t;
			});
			chunks.push(draw(video, video.videoWidth, video.videoHeight));
		}
		const all = new Uint8ClampedArray(chunks.reduce((n, c) => n + c.length, 0));
		let offset = 0;
		for (const c of chunks) {
			all.set(c, offset);
			offset += c.length;
		}
		return all;
	} finally {
		video.removeAttribute("src");
		video.load();
		URL.revokeObjectURL(url);
	}
}

/** Paleta de la referencia y colores de marca propuestos. */
export async function paletteFromFile(
	file: File,
): Promise<{ swatches: Swatch[]; theme: ThemeProposal }> {
	const pixels = file.type.startsWith("video/") ? await videoPixels(file) : await imagePixels(file);
	const swatches = extractPalette(pixels);
	const theme = themeFromPalette(swatches);
	if (!theme) throw new Error("La referencia no tiene colores que leer.");
	return { swatches, theme };
}

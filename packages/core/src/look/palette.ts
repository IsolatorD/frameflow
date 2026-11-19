import { contrastRatio } from "../project/project";

// «Estilo desde una referencia», fase 1: los colores. De los píxeles de una imagen (o de varios
// fotogramas de un video) se saca la paleta dominante y, de ella, una propuesta de colores de la
// marca (fondo, texto, acento y apagado) que se lea bien en video. Todo local y determinista.

export type Swatch = { color: string; share: number };
export type ThemeProposal = { background: string; text: string; accent: string; muted: string };

type Rgb = [number, number, number];

const hex = ([r, g, b]: Rgb) =>
	`#${[r, g, b]
		.map((v) =>
			Math.round(Math.max(0, Math.min(255, v)))
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`.toUpperCase();
const rgb = (h: string): Rgb => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as Rgb;
const dist2 = (a: Rgb, b: Rgb) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** Saturación y luminosidad (HSL), 0–1. */
function hsl([r, g, b]: Rgb) {
	const [R, G, B] = [r / 255, g / 255, b / 255];
	const max = Math.max(R, G, B);
	const min = Math.min(R, G, B);
	const l = (max + min) / 2;
	const d = max - min;
	const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
	let h = 0;
	if (d !== 0) h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
	return { h: (h * 60 + 360) % 360, s, l };
}

function fromHsl(h: number, s: number, l: number): Rgb {
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	const [r, g, b] =
		h < 60
			? [c, x, 0]
			: h < 120
				? [x, c, 0]
				: h < 180
					? [0, c, x]
					: h < 240
						? [0, x, c]
						: h < 300
							? [x, 0, c]
							: [c, 0, x];
	return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/**
 * Paleta dominante: agrupa los píxeles (RGBA) en hasta `k` colores con k-means (inicio por el
 * punto más lejano, determinista) y devuelve cada color con la parte de la imagen que ocupa.
 */
export function extractPalette(
	pixels: Uint8ClampedArray | Uint8Array,
	{ k = 6, samples = 6000 }: { k?: number; samples?: number } = {},
): Swatch[] {
	const total = Math.floor(pixels.length / 4);
	const step = Math.max(1, Math.floor(total / samples));
	const points: Rgb[] = [];
	for (let i = 0; i < total; i += step) {
		const o = i * 4;
		if ((pixels[o + 3] ?? 255) < 128) continue; // transparentes fuera
		points.push([pixels[o] ?? 0, pixels[o + 1] ?? 0, pixels[o + 2] ?? 0]);
	}
	if (points.length === 0) return [];
	// Inicio: la media y luego, uno a uno, el punto más lejano de los centros elegidos.
	const mean: Rgb = [0, 1, 2].map(
		(c) => points.reduce((s, p) => s + p[c as 0], 0) / points.length,
	) as Rgb;
	const centers: Rgb[] = [];
	let next = points.reduce((best, p) => (dist2(p, mean) < dist2(best, mean) ? p : best));
	while (centers.length < k) {
		centers.push([...next]);
		let far = -1;
		for (const p of points) {
			const d = Math.min(...centers.map((c) => dist2(p, c)));
			if (d > far) {
				far = d;
				next = p;
			}
		}
		if (far <= 64) break; // ya no quedan colores distintos
	}
	const assign = new Array<number>(points.length).fill(0);
	for (let iter = 0; iter < 12; iter++) {
		points.forEach((p, i) => {
			let best = 0;
			centers.forEach((c, j) => {
				if (dist2(p, c) < dist2(p, centers[best] as Rgb)) best = j;
			});
			assign[i] = best;
		});
		centers.forEach((_, j) => {
			const own = points.filter((_p, i) => assign[i] === j);
			if (own.length)
				centers[j] = [0, 1, 2].map(
					(c) => own.reduce((s, p) => s + p[c as 0], 0) / own.length,
				) as Rgb;
		});
	}
	const counts = centers.map((_, j) => assign.filter((a) => a === j).length);
	// Juntar colores casi iguales.
	const swatches: { c: Rgb; n: number }[] = [];
	centers.forEach((c, j) => {
		const n = counts[j] ?? 0;
		if (!n) return;
		const near = swatches.find((s) => dist2(s.c, c) < 20 ** 2);
		if (near) {
			near.c = [0, 1, 2].map(
				(i) => (near.c[i as 0] * near.n + c[i as 0] * n) / (near.n + n),
			) as Rgb;
			near.n += n;
		} else swatches.push({ c, n });
	});
	return swatches
		.sort((a, b) => b.n - a.n)
		.map((s) => ({ color: hex(s.c), share: Math.round((s.n / points.length) * 1000) / 1000 }));
}

/** Aclara u oscurece un color (sin cambiar su tono) hasta que contraste lo pedido con el fondo. */
export function withContrast(color: string, background: string, min: number): string {
	if (contrastRatio(color, background) >= min) return color;
	const { h, s, l } = hsl(rgb(color));
	const lighter = hsl(rgb(background)).l < 0.5;
	for (let i = 1; i <= 20; i++) {
		const nl = Math.max(0, Math.min(1, l + (lighter ? 1 : -1) * i * 0.04));
		const candidate = hex(fromHsl(h, s, nl));
		if (contrastRatio(candidate, background) >= min) return candidate;
	}
	return lighter ? "#FFFFFF" : "#111111";
}

const mix = (a: string, b: string, t: number) => {
	const [A, B] = [rgb(a), rgb(b)];
	return hex([0, 1, 2].map((i) => A[i as 0] + (B[i as 0] - A[i as 0]) * t) as Rgb);
};

/** Acentos de reserva: vivos y conocidos (amarillo, verde, azul, rojo, violeta) y blanco/negro. */
const FALLBACK_ACCENTS = [
	"#FFC83D",
	"#3DDC97",
	"#4D7CFE",
	"#FF4D6D",
	"#9B5CFF",
	"#FFFFFF",
	"#111111",
];

/**
 * Colores de marca a partir de una paleta:
 * - fondo: el color que más ocupa;
 * - texto: el color de la paleta que más contrasta con el fondo si llega a 4,5:1; si no, casi
 *   blanco o casi negro;
 * - acento: el más vivo de los demás (saturación y presencia), ajustado para llegar a 3:1;
 * - apagado: entre el texto y el fondo, para textos secundarios.
 */
export function themeFromPalette(swatches: readonly Swatch[]): ThemeProposal | null {
	const first = swatches[0];
	if (!first) return null;
	const background = first.color;
	const others = swatches.slice(1);
	const bestText = [...others].sort(
		(a, b) => contrastRatio(b.color, background) - contrastRatio(a.color, background),
	)[0];
	const light = hsl(rgb(background)).l < 0.5;
	const text =
		bestText && contrastRatio(bestText.color, background) >= 4.5
			? bestText.color
			: light
				? "#FFFFFF"
				: "#111111";
	const vivid = others
		.filter((s) => s.color !== text)
		.map((s) => {
			const { s: sat, l } = hsl(rgb(s.color));
			// Vivo y presente; los casi grises o casi negros/blancos puntúan poco.
			return { s, score: sat * (1 - Math.abs(l - 0.5)) * 2 + Math.min(0.3, s.share) };
		})
		.filter((v) => v.score > 0.35)
		.sort((a, b) => b.score - a.score);
	// El primero que llegue a 3:1 sin perder su carácter (cambiando poco su luminosidad); si ninguno,
	// un acento estándar que contraste con el fondo.
	const keepsCharacter = (from: string, to: string) =>
		Math.abs(hsl(rgb(from)).l - hsl(rgb(to)).l) <= 0.22;
	const fromPalette = vivid
		.map((v) => ({ from: v.s.color, to: withContrast(v.s.color, background, 3) }))
		.find((c) => keepsCharacter(c.from, c.to));
	const fallback = FALLBACK_ACCENTS.filter((c) => c !== text).sort(
		(a, b) => contrastRatio(b, background) - contrastRatio(a, background),
	)[0] as string;
	const accent = fromPalette?.to ?? withContrast(fallback, background, 3);
	return { background, text, accent, muted: mix(text, background, 0.35) };
}

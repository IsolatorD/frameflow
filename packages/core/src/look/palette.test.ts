import { describe, expect, it } from "vitest";
import { contrastRatio } from "../project/project";
import { extractPalette, themeFromPalette, withContrast } from "./palette";

/** Imagen RGBA de prueba con franjas: [color, píxeles]. */
const image = (bands: [[number, number, number], number][]) => {
	const out: number[] = [];
	for (const [[r, g, b], n] of bands) for (let i = 0; i < n; i++) out.push(r, g, b, 255);
	return Uint8ClampedArray.from(out);
};

describe("estilo desde una referencia: colores", () => {
	it("saca los colores dominantes con la parte que ocupan", () => {
		const palette = extractPalette(
			image([
				[[16, 32, 80], 6000],
				[[250, 245, 235], 2500],
				[[242, 186, 29], 1500],
			]),
		);
		expect(palette.map((s) => s.color)).toEqual(["#102050", "#FAF5EB", "#F2BA1D"]);
		expect(palette[0]?.share).toBeCloseTo(0.6, 1);
	});

	it("junta tonos casi iguales e ignora los píxeles transparentes", () => {
		const px = image([
			[[200, 40, 40], 500],
			[[205, 44, 38], 500],
		]);
		const transparent = Uint8ClampedArray.from([0, 255, 0, 0, 0, 255, 0, 0]);
		const palette = extractPalette(Uint8ClampedArray.from([...px, ...transparent]));
		expect(palette).toHaveLength(1);
		expect(palette[0]?.share).toBe(1);
	});

	it("propone fondo, texto legible y un acento que contrasta", () => {
		const theme = themeFromPalette([
			{ color: "#102050", share: 0.6 },
			{ color: "#FAF5EB", share: 0.25 },
			{ color: "#F2BA1D", share: 0.15 },
		]);
		expect(theme).toMatchObject({ background: "#102050", text: "#FAF5EB", accent: "#F2BA1D" });
		expect(contrastRatio(theme?.muted ?? "", "#102050")).toBeGreaterThan(3);
	});

	it("si la paleta no tiene un texto legible ni un acento, los crea", () => {
		const theme = themeFromPalette([
			{ color: "#F4F1EA", share: 0.8 },
			{ color: "#E8E4DA", share: 0.2 },
		]);
		expect(theme?.text).toBe("#111111");
		expect(contrastRatio(theme?.accent ?? "", "#F4F1EA")).toBeGreaterThanOrEqual(3);
	});

	it("no deforma el acento: si para contrastar cambiaría demasiado, usa uno de reserva", () => {
		// Amarillo sobre rosa no llega a 3:1; oscurecerlo lo volvería oliva.
		const theme = themeFromPalette([
			{ color: "#FF00AA", share: 0.5 },
			{ color: "#FFDD33", share: 0.5 },
		]);
		expect(contrastRatio(theme?.accent ?? "", "#FF00AA")).toBeGreaterThanOrEqual(3);
		expect(theme?.accent).not.toBe(theme?.text);
		expect(["#FFC83D", "#3DDC97", "#4D7CFE", "#FF4D6D", "#9B5CFF", "#FFFFFF"]).toContain(
			theme?.accent,
		);
	});

	it("ajusta un color hasta que contraste con el fondo sin cambiar su tono", () => {
		const fixed = withContrast("#2E3A8C", "#101530", 3);
		expect(contrastRatio(fixed, "#101530")).toBeGreaterThanOrEqual(3);
		expect(fixed).not.toBe("#FFFFFF");
	});
});

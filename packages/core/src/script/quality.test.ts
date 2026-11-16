import { describe, expect, it } from "vitest";
import { isCopiedLine, qualityReport, similarity } from "./quality";

describe("métricas de calidad del guion", () => {
	it("detecta líneas copiadas literalmente de la narración", () => {
		const narration = "Un agujero negro es un objeto extremadamente denso.";
		expect(isCopiedLine("es un objeto", narration)).toBe(true);
		expect(isCopiedLine("Densidad extrema", narration)).toBe(false);
		expect(isCopiedLine("Agujero negro", narration)).toBe(false); // 2 palabras: es una palabra clave
	});

	it("mide el parecido entre narraciones ignorando palabras vacías", () => {
		expect(
			similarity(
				"Una nube de tamaño medio pesa más de cien toneladas.",
				"Una nube no es lo que parece. Pesa más de cien toneladas.",
			),
		).toBeGreaterThanOrEqual(0.6);
		expect(similarity("Marte es rojo por el óxido.", "La luz tarda ocho minutos.")).toBe(0);
	});

	it("resume un guion", () => {
		const report = qualityReport(
			{
				title: "x",
				scenes: [
					{
						narration: "Un agujero negro es un objeto extremadamente denso.",
						content: {
							type: "kinetic-text",
							lines: [{ text: "es un objeto" }, { text: "Muy denso" }],
						},
					},
					{
						narration: "Un agujero negro es un objeto denso y extremo.",
						content: { type: "stat", value: 1, label: "x" },
					},
				],
			},
			10,
		);
		expect(report).toMatchObject({
			scenes: 2,
			statScenes: 1,
			lines: 2,
			copiedLines: 1,
			repeatedPairs: [[0, 1]],
		});
	});
});

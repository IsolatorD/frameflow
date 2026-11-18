import { describe, expect, it } from "vitest";
import { FREE_STYLE, resolveVisualStyle, visualStyleLabel, visualStyleSchema } from "./looks";

describe("estilos visuales", () => {
	it("por defecto es Libre", () => {
		expect(visualStyleSchema.parse({})).toEqual(FREE_STYLE);
		expect(resolveVisualStyle(undefined)).toEqual(FREE_STYLE);
	});

	it("completa opciones, ignora las desconocidas y cae a Libre si el estilo no existe", () => {
		expect(resolveVisualStyle({ id: "hologram", options: {} })).toEqual({
			id: "hologram",
			options: { model: "planet" },
		});
		expect(
			resolveVisualStyle({ id: "hologram", options: { model: "rocket", color: "rojo" } }),
		).toEqual({ id: "hologram", options: { model: "rocket" } });
		expect(resolveVisualStyle({ id: "hologram", options: { model: "dragón" } }).options.model).toBe(
			"planet",
		);
		expect(resolveVisualStyle({ id: "scale-zoom", options: { journey: "out" } })).toEqual({
			id: "scale-zoom",
			options: { journey: "out" },
		});
		expect(resolveVisualStyle({ id: "estilo-del-futuro", options: {} })).toEqual(FREE_STYLE);
	});

	it("nombre para mostrar", () => {
		expect(visualStyleLabel({ id: "hologram", options: { model: "ringed" } })).toBe(
			"Holograma · Planeta con anillos",
		);
		expect(visualStyleLabel({ id: "scale-zoom", options: {} })).toBe(
			"Viaje de escala · Del cosmos a lo diminuto",
		);
		expect(visualStyleLabel(FREE_STYLE)).toBe("Libre");
	});
});

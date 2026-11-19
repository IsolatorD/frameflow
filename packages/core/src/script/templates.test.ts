import { describe, expect, it } from "vitest";
import { readingSeconds } from "../storyboard/scenes";
import { generateScript, type LlmProvider, scriptSystemPrompt } from "./ai";
import { scriptSchema } from "./script";
import { SCRIPT_TEMPLATES, scriptTemplate } from "./templates";

const scene = (visual: string, extra: Record<string, unknown> = {}) => ({
	narration: "Esta escena cuenta algo interesante sobre el tema del video.",
	visual,
	lines: visual === "texto" ? [{ text: "Algo corto", emphasis: true }] : [],
	value: 0,
	suffix: "",
	label: "",
	items: [],
	...extra,
});

describe("plantillas de estructura", () => {
	it("cada plantilla tiene un guion inicial válido para el modo paso a paso", () => {
		for (const t of SCRIPT_TEMPLATES) {
			const script = t.starter("Cómo se forma un arcoíris");
			expect(() => scriptSchema.parse(script), t.id).not.toThrow();
		}
		expect(scriptTemplate("paso-a-paso").starter("x").scenes[1]?.content.type).toBe("steps");
		expect(scriptTemplate("no-existe").id).toBe("libre");
	});

	it("la guía de la plantilla va en el prompt", () => {
		const prompt = scriptSystemPrompt({
			tone: "curioso",
			language: "es",
			seconds: 45,
			template: scriptTemplate("historia"),
		});
		expect(prompt).toContain("Estructura del video («Historia»)");
		expect(prompt).toContain('Una escena "linea"');
	});

	it("si la plantilla pide pasos y la IA no los usa, se le pide una vez", async () => {
		const answers = [
			{ title: "Arcoíris", scenes: [scene("texto"), scene("texto"), scene("texto")] },
			{
				title: "Arcoíris",
				scenes: [
					scene("texto"),
					scene("pasos", {
						items: [
							{ label: "La luz entra en la gota", value: "" },
							{ label: "Se separa en colores", value: "" },
						],
					}),
					scene("texto"),
				],
			},
		];
		const seen: string[] = [];
		const llm: LlmProvider = {
			name: "prueba",
			async generateJson(messages) {
				seen.push(messages.at(-1)?.content ?? "");
				return JSON.stringify(answers.shift());
			},
		};
		const script = await generateScript(llm, {
			topic: "arcoíris",
			tone: "curioso",
			language: "es",
			seconds: 10,
			template: "paso-a-paso",
		});
		expect(seen[1]).toContain('pide una escena "pasos"');
		expect(script.scenes[1]?.content.type).toBe("steps");
	});
});

describe("tiempo de lectura", () => {
	it("crece con las palabras y con los elementos de una lista", () => {
		expect(readingSeconds({ type: "kinetic-text", lines: [{ text: "Hola mundo" }] })).toBe(1);
		const long = readingSeconds({
			type: "kinetic-text",
			lines: [{ text: "Una frase bastante más larga" }, { text: "y otra línea más" }],
		});
		expect(long).toBeGreaterThan(2);
		const steps = readingSeconds({ type: "steps", items: ["Uno", "Dos", "Tres", "Cuatro"] });
		expect(steps).toBeGreaterThan(readingSeconds({ type: "steps", items: ["Uno", "Dos"] }));
	});
});

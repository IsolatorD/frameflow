import { describe, expect, it } from "vitest";
import { findClip, storyboardDuration } from "../storyboard/timeline";
import { generateScript, type LlmProvider } from "./ai";
import { assembleStoryboard, estimateSeconds, scriptFromStoryboard, starterScript } from "./script";

const style = {
	theme: { background: "#000000", text: "#FFFFFF", accent: "#FAC775", muted: "#888888" },
	fontFamily: "Montserrat",
	captions: { enabled: true, maxWordsPerPage: 4 },
};

const fakeLlm = (responses: string[]): LlmProvider & { calls: number; lastMessages: unknown[] } => {
	const llm = {
		name: "fake",
		calls: 0,
		lastMessages: [] as unknown[],
		async generateJson(messages: unknown[]) {
			llm.lastMessages = messages;
			return responses[llm.calls++] ?? "{}";
		},
	};
	return llm;
};

const textScene = (narration: string, line: string) => ({
	narration,
	visual: "texto",
	lines: [{ text: line, emphasis: true }],
	value: 0,
	suffix: "",
	label: "",
});

const validAnswer = JSON.stringify({
	title: "La luz del Sol",
	scenes: [
		textScene("¿Sabías que la luz del Sol es del pasado?", "La luz del Sol"),
		{
			narration: "Tarda unos ocho minutos en llegar hasta aquí.",
			visual: "cifra",
			lines: [],
			value: 8,
			suffix: " min",
			label: "en llegar",
		},
		textScene("Cada vez que miras al cielo, miras al pasado.", "Miras al pasado"),
	],
});

describe("generateScript", () => {
	it("convierte la respuesta de la IA en un guion", async () => {
		const script = await generateScript(fakeLlm([validAnswer]), {
			topic: "luz",
			tone: "curioso",
			language: "es",
			seconds: 10,
		});
		expect(script.scenes).toHaveLength(3);
		expect(script.scenes[1]?.content).toEqual({
			type: "stat",
			value: 8,
			suffix: " min",
			label: "en llegar",
		});
	});

	it("devuelve el error a la IA y reintenta", async () => {
		const llm = fakeLlm(["no es json", validAnswer]);
		const script = await generateScript(llm, {
			topic: "luz",
			tone: "curioso",
			language: "es",
			seconds: 10,
		});
		expect(llm.calls).toBe(2);
		expect(script.title).toBe("La luz del Sol");
		expect(JSON.stringify(llm.lastMessages)).toContain("Tu JSON no es válido");
	});

	it("rechaza guiones válidos de forma pero inservibles y explica por qué", async () => {
		// Lo que devolvió Qwen3 8B con el formato anterior: todo "cifra" con 0 y fragmentos.
		const useless = JSON.stringify({
			title: "Marte",
			scenes: [1, 2, 3].map(() => ({
				narration: "La superficie de Marte",
				visual: "cifra",
				lines: [],
				value: 0,
				suffix: "",
				label: "kinetic-text",
			})),
		});
		const llm = fakeLlm([useless, validAnswer]);
		await generateScript(llm, { topic: "Marte", tone: "", language: "es", seconds: 10 });
		const feedback = JSON.stringify(llm.lastMessages);
		expect(feedback).toContain("frases completas");
		expect(feedback).toContain("explica el número");
		expect(feedback).toContain("un número real");
		expect(feedback).toContain("el resto de escenas deben ser");
	});

	it("pide alargar un guion corto y no corta líneas: las devuelve como error", async () => {
		const short = JSON.stringify({
			title: "Corto",
			scenes: [1, 2, 3].map(() =>
				textScene("Una frase de cinco palabras.", "¿Sabías que hay objetos tan fuertes?"),
			),
		});
		const llm = fakeLlm([short, validAnswer]);
		await generateScript(llm, { topic: "x", tone: "", language: "es", seconds: 10 });
		const feedback = JSON.stringify(llm.lastMessages);
		expect(feedback).toContain("Alarga las narraciones");
		expect(feedback).toContain("es demasiado larga");
	});

	it("se rinde tras tres intentos", async () => {
		await expect(
			generateScript(fakeLlm(["{}", "{}", "{}"]), {
				topic: "x",
				tone: "",
				language: "es",
				seconds: 10,
			}),
		).rejects.toThrow("tras 3 intentos");
	});
});

describe("assembleStoryboard", () => {
	const script = starterScript("los agujeros negros");

	it("sin voz usa duraciones estimadas y añade la llamada a la acción al final", () => {
		const sb = assembleStoryboard({
			script,
			language: "es",
			format: "9:16",
			style,
			ctaText: "Síguenos",
		});
		const expected = script.scenes.reduce((t, s) => t + estimateSeconds(s.narration), 0);
		expect(storyboardDuration(sb)).toBeCloseTo(expected);
		const cta = findClip(sb, "cta")?.clip;
		expect(cta && cta.start + cta.duration).toBeCloseTo(expected);
	});

	it("con voz, cada escena dura la voz más un respiro, y el guion se recupera intacto", () => {
		const voices = script.scenes.map((_, i) => ({ src: `v${i}.wav`, duration: 4 }));
		const sb = assembleStoryboard({ script, language: "es", format: "9:16", style, voices });
		expect(storyboardDuration(sb)).toBeCloseTo(13.5);
		expect(findClip(sb, "voice-2")?.clip.start).toBeCloseTo(4.5);
		expect(scriptFromStoryboard(sb)).toEqual(script);
	});
});

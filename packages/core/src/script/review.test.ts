import { describe, expect, it } from "vitest";
import type { LlmMessage, LlmProvider } from "./ai";
import { applySuggestion, canApply, reviewScript, scriptForReview } from "./review";
import type { Script } from "./script";

const script: Script = {
	title: "Por qué el cielo es azul",
	scenes: [
		{
			narration: "¿Sabías que el cielo no es azul de verdad?",
			content: { type: "kinetic-text", lines: [{ text: "¿Cielo azul?" }] },
		},
		{
			narration: "La luz del Sol tarda ocho minutos en llegar.",
			content: { type: "stat", value: 8, suffix: " min", label: "tarda la luz del Sol" },
		},
		{
			narration: "Comenta si lo sabías.",
			content: { type: "kinetic-text", lines: [{ text: "¿Lo sabías?" }] },
		},
	],
};

/** IA de prueba: devuelve las respuestas en orden y guarda lo que recibió. */
function fakeLlm(answers: unknown[]) {
	const calls: LlmMessage[][] = [];
	const llm: LlmProvider = {
		name: "prueba",
		async generateJson(messages) {
			calls.push(messages.map((m) => ({ ...m })));
			return JSON.stringify(answers.shift());
		},
	};
	return { llm, calls };
}

const suggestion = (over: Record<string, unknown> = {}) => ({
	scene: 3,
	aspect: "cierre",
	quote: "Comenta si lo sabías.",
	problem: "El cierre no responde por qué el cielo se ve azul.",
	change: "Cierra con la respuesta: la luz azul se dispersa más.",
	narration: "El aire dispersa más la luz azul, por eso el cielo se ve de ese color.",
	lines: ["La luz azul", "se dispersa más"],
	emphasis: 1,
	...over,
});

describe("revisar guion con IA", () => {
	it("pasa el guion numerado y devuelve veredicto, lo que conservar y propuestas", async () => {
		const { llm, calls } = fakeLlm([
			{
				verdict: "El gancho promete una respuesta que el cierre no da.",
				keep: ["La pregunta inicial"],
				suggestions: [
					suggestion(),
					suggestion({ scene: 0, aspect: "progresion", narration: "", lines: [], emphasis: -1 }),
				],
			},
		]);
		const review = await reviewScript(llm, script, {
			topic: "el cielo",
			tone: "cercano",
			language: "es",
		});
		expect(calls[0]?.[1]?.content).toContain(
			"Escena 2 (cifra en pantalla: 8 min — tarda la luz del Sol)",
		);
		expect(review.verdict).toMatch(/promete/);
		expect(review.keep).toEqual(["La pregunta inicial"]);
		expect(review.suggestions[0]).toMatchObject({
			scene: 2,
			aspect: "cierre",
			lines: [{ text: "La luz azul" }, { text: "se dispersa más", emphasis: true }],
		});
		// La propuesta general no se aplica con un clic.
		expect(review.suggestions[1]).toMatchObject({ scene: null });
		expect(canApply(review.suggestions[1] as never)).toBe(false);
	});

	it("devuelve los errores a la IA: escena inexistente y números con cifras", async () => {
		const { llm, calls } = fakeLlm([
			{ verdict: "x", keep: [], suggestions: [suggestion({ scene: 7 })] },
			{ verdict: "x", keep: [], suggestions: [suggestion({ narration: "Son 8 minutos." })] },
			{ verdict: "Bien", keep: [], suggestions: [suggestion()] },
		]);
		const review = await reviewScript(llm, script, {
			topic: "el cielo",
			tone: "cercano",
			language: "es",
		});
		expect(calls).toHaveLength(3);
		expect(calls[1]?.at(-1)?.content).toMatch(/"scene" debe ser de 1 a 3/);
		expect(calls[2]?.at(-1)?.content).toMatch(/números de la narración con letras/);
		expect(review.verdict).toBe("Bien");
	});

	it("no acepta texto en pantalla para una escena de cifra", async () => {
		const { llm, calls } = fakeLlm([
			{ verdict: "x", keep: [], suggestions: [suggestion({ scene: 2 })] },
			{ verdict: "ok", keep: [], suggestions: [suggestion({ scene: 2, lines: [] })] },
		]);
		const review = await reviewScript(llm, script, { topic: "t", tone: "t", language: "es" });
		expect(calls[1]?.at(-1)?.content).toMatch(/"lines" solo vale para escenas de texto/);
		expect(review.suggestions[0]?.lines).toBeUndefined();
	});

	it("aplica una propuesta: narración y texto en pantalla de esa escena", () => {
		const next = applySuggestion(script, {
			scene: 2,
			aspect: "cierre",
			quote: "",
			problem: "p",
			change: "c",
			narration: "Nueva narración.",
			lines: [{ text: "Nuevo texto", emphasis: true }],
		});
		expect(next.scenes[2]).toEqual({
			narration: "Nueva narración.",
			content: { type: "kinetic-text", lines: [{ text: "Nuevo texto", emphasis: true }] },
		});
		expect(next.scenes[0]).toBe(script.scenes[0]);
		expect(scriptForReview("t", next)).toContain("Escena 3 (texto en pantalla: «Nuevo texto»)");
	});
});

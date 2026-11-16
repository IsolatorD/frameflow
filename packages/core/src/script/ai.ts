import { z } from "zod";
import { type Script, sceneRange, scriptSchema, WORDS_PER_SECOND } from "./script";

// Generación del guion con un LLM. El proveedor es intercambiable (Ollama hoy; Claude/OpenAI mañana).

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

export interface LlmProvider {
	readonly name: string;
	/** Devuelve texto JSON que cumple `jsonSchema`. */
	generateJson(messages: LlmMessage[], jsonSchema: object, signal?: AbortSignal): Promise<string>;
}

export type LlmStatus =
	| { available: true; name: string }
	| { available: false; name: string; reason: string };

// Lo ÚNICO que escribe la IA. Límites de longitud pensados para pantalla vertical.
//
// Formato PLANO a propósito: con salida restringida por JSON Schema, una unión de tipos (anyOf)
// hace que modelos pequeños se queden en la primera rama (probado con Qwen3 8B: todas las escenas
// salían como "cifra" con valor 0). Aquí cada escena tiene todos los campos y `visual` decide
// cuáles cuentan; las reglas de cada tipo se validan después y el error se le devuelve a la IA.
// Tampoco hay límites de longitud en el esquema: con salida restringida, un maxLength obliga al
// modelo a cortar palabras a la mitad ("objetos tan fu"). Las longitudes se validan después.
const TECHNICAL_WORDS = /^(kinetic-text|stat|texto|cifra|narration|narración|gancho|label)$/i;

const llmScene = z.object({
	narration: z.string().min(1),
	visual: z.enum(["texto", "cifra"]),
	lines: z.array(z.object({ text: z.string(), emphasis: z.boolean() })),
	value: z.number(),
	suffix: z.string(),
	label: z.string(),
});

export const LIMITS = { line: 30, lines: 3, title: 60, suffix: 8, label: 40 } as const;
/** Margen aceptado sobre la duración pedida (la IA no cuenta palabras con precisión). */
export const DURATION_TOLERANCE = { min: 0.75, max: 1.35 } as const;

const llmOutput = (range: [number, number], seconds: number) =>
	z
		.object({
			title: z.string().min(1),
			scenes: z.array(llmScene).min(range[0]).max(range[1]),
		})
		.superRefine((out, ctx) => {
			const issue = (message: string, path: (string | number)[] = []) =>
				ctx.addIssue({ code: "custom", message, path });
			const problem = (i: number, message: string) =>
				issue(`Escena ${i + 1}: ${message}`, ["scenes", i]);
			if (out.title.length > LIMITS.title)
				issue(`El título es demasiado largo (máx. ${LIMITS.title} caracteres).`, ["title"]);

			const words = out.scenes.reduce((t, s) => t + s.narration.trim().split(/\s+/).length, 0);
			const estimated = Math.round(words / WORDS_PER_SECOND);
			if (estimated < seconds * DURATION_TOLERANCE.min)
				issue(
					`El guion dura unos ${estimated} s y el objetivo son ${seconds} s (unas ${Math.round(seconds * WORDS_PER_SECOND)} palabras de narración en total). Alarga las narraciones con información nueva, sin repetir datos.`,
				);
			if (estimated > seconds * DURATION_TOLERANCE.max)
				issue(
					`El guion dura unos ${estimated} s y el objetivo son ${seconds} s. Acorta las narraciones.`,
				);

			out.scenes.forEach((scene, i) => {
				if (scene.lines.length > LIMITS.lines) problem(i, `como mucho ${LIMITS.lines} líneas.`);
				for (const line of scene.lines) {
					if (line.text.length > LIMITS.line)
						problem(
							i,
							`la línea "${line.text}" es demasiado larga (máx. ${LIMITS.line} caracteres): resúmela en 2 a 4 palabras.`,
						);
				}
				if (scene.suffix.length > LIMITS.suffix)
					problem(i, `"suffix" es la unidad corta (máx. ${LIMITS.suffix} caracteres).`);
				if (scene.label.length > LIMITS.label)
					problem(i, `"label" es demasiado largo (máx. ${LIMITS.label} caracteres).`);
				if (scene.narration.trim().split(/\s+/).length < 5)
					problem(i, "la narración debe ser una o dos frases completas, no un fragmento.");
				if (/\d/.test(scene.narration))
					problem(i, "escribe los números de la narración con letras.");
				if (scene.visual === "texto" && !scene.lines.some((l) => l.text.trim()))
					problem(i, 'una escena "texto" necesita de 1 a 3 líneas con texto.');
				if (scene.visual === "cifra") {
					if (!scene.label.trim() || TECHNICAL_WORDS.test(scene.label.trim()))
						problem(i, 'en una escena "cifra", "label" es una frase corta que explica el número.');
					if (scene.value === 0)
						problem(i, 'una escena "cifra" necesita un número real en "value".');
				}
			});
			if (out.scenes.every((s) => s.visual === "cifra"))
				ctx.addIssue({
					code: "custom",
					message: 'Usa "cifra" solo para datos numéricos; el resto de escenas deben ser "texto".',
					path: ["scenes"],
				});
		});

/** Ejemplo de respuesta (otro tema) para que el modelo vea la forma esperada. */
const EXAMPLE = JSON.stringify({
	title: "¿Por qué el mar es salado?",
	scenes: [
		{
			narration:
				"¿Alguna vez te preguntaste por qué el agua del mar es salada y la de los ríos no?",
			visual: "texto",
			lines: [
				{ text: "¿Por qué el mar", emphasis: false },
				{ text: "es salado?", emphasis: true },
			],
			value: 0,
			suffix: "",
			label: "",
		},
		{
			narration: "Cada litro de agua de mar lleva unos treinta y cinco gramos de sal disuelta.",
			visual: "cifra",
			lines: [],
			value: 35,
			suffix: " g",
			label: "de sal por litro",
		},
	],
});

const LANGUAGE_NAMES: Record<string, string> = { es: "español", en: "inglés" };

export const scriptSystemPrompt = (opts: {
	tone: string;
	language: string;
	seconds: number;
	channel?: string;
}) => {
	const [min, max] = sceneRange(opts.seconds);
	return `Eres guionista de videos verticales informativos para TikTok, Reels y Shorts${
		opts.channel ? ` del canal "${opts.channel}"` : ""
	}.
Escribe en ${LANGUAGE_NAMES[opts.language] ?? opts.language}. Tono: ${opts.tone}

Reglas:
- Duración objetivo: ${opts.seconds} segundos de narración en total, es decir, unas ${Math.round(opts.seconds * WORDS_PER_SECOND)} palabras
  (unas ${Math.round((opts.seconds * WORDS_PER_SECOND) / Math.round((min + max) / 2))} palabras por escena si usas ${Math.round((min + max) / 2)} escenas).
- Entre ${min} y ${max} escenas. La primera es un gancho; la última, un cierre memorable.
- "narration": lo que dice la voz en esa escena, 1 o 2 frases completas.
  Escribe TODOS los números con letras (p. ej. "ocho minutos", nunca "8 minutos").
- "visual" decide lo que se ve en pantalla:
  - "texto" (la mayoría de escenas): "lines" son 1 a 3 trozos MUY cortos (máx. 4 palabras cada uno)
    que resumen visualmente la narración; "emphasis": true solo en la línea clave (como mucho una).
    Deja "value": 0, "suffix": "" y "label": "".
  - "cifra" (solo cuando la escena gira en torno a un número): "value" es el número en cifras,
    "suffix" su unidad corta (" min", "%", " km"…; puede ser "") y "label" una frase corta que
    explica la cifra. Deja "lines": [].
- Usa "cifra" en una o dos escenas si el tema tiene datos numéricos; el resto, "texto".
- Cada escena aporta algo nuevo: no repitas un dato ni una idea que ya dijiste.
- Las "lines" resumen la idea de su narración con otras palabras; no copies trozos de la frase.
- Solo hechos verificables y ampliamente aceptados. Si no estás seguro de una cifra, no la uses.
Ejemplo de la forma (sobre otro tema, más corto):
${EXAMPLE}

Responde solo con el JSON pedido.`;
};

export const MAX_ATTEMPTS = 3;

/** Pide el guion a la IA; si la respuesta no es válida, le devuelve el error para que se corrija. */
export async function generateScript(
	llm: LlmProvider,
	opts: {
		topic: string;
		tone: string;
		language: string;
		seconds: number;
		channel?: string;
		signal?: AbortSignal;
	},
): Promise<Script> {
	const schema = llmOutput(sceneRange(opts.seconds), opts.seconds);
	const messages: LlmMessage[] = [
		{ role: "system", content: scriptSystemPrompt(opts) },
		{ role: "user", content: `Tema del video: ${opts.topic}` },
	];
	let lastProblem = "";
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		const raw = await llm.generateJson(messages, z.toJSONSchema(schema), opts.signal);
		try {
			const out = schema.parse(JSON.parse(raw));
			return scriptSchema.parse({
				title: out.title,
				scenes: out.scenes.map((scene) =>
					scene.visual === "cifra"
						? {
								narration: scene.narration,
								content: {
									type: "stat",
									value: scene.value,
									suffix: scene.suffix || undefined,
									label: scene.label,
								},
							}
						: {
								narration: scene.narration,
								content: {
									type: "kinetic-text",
									lines: scene.lines
										.filter((l) => l.text.trim())
										.map((l) => (l.emphasis ? l : { text: l.text })),
								},
							},
				),
			});
		} catch (error) {
			lastProblem = error instanceof z.ZodError ? z.prettifyError(error) : String(error);
		}
		messages.push(
			{ role: "assistant", content: raw },
			{
				role: "user",
				content: `Tu JSON no es válido:\n${lastProblem}\nCorrígelo y responde de nuevo.`,
			},
		);
	}
	throw new Error(`La IA no produjo un guion válido tras ${MAX_ATTEMPTS} intentos: ${lastProblem}`);
}

/** Proveedor local con Ollama (salida estructurada con JSON Schema). */
export class OllamaProvider implements LlmProvider {
	readonly name: string;

	constructor(
		private readonly model: string,
		private readonly baseUrl = "http://localhost:11434",
	) {
		this.name = `Ollama · ${model}`;
	}

	async status(): Promise<LlmStatus> {
		try {
			const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
			const data = (await res.json()) as { models?: { name: string }[] };
			const installed = (data.models ?? []).some(
				(m) => m.name === this.model || m.name === `${this.model}:latest`,
			);
			return installed
				? { available: true, name: this.name }
				: {
						available: false,
						name: this.name,
						reason: `El modelo ${this.model} no está instalado en Ollama.`,
					};
		} catch {
			return {
				available: false,
				name: this.name,
				reason: "Ollama no está en marcha en este equipo.",
			};
		}
	}

	async generateJson(
		messages: LlmMessage[],
		jsonSchema: object,
		signal?: AbortSignal,
	): Promise<string> {
		const res = await fetch(`${this.baseUrl}/api/chat`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			signal,
			body: JSON.stringify({
				model: this.model,
				messages,
				format: jsonSchema,
				stream: false,
				think: false,
				options: { temperature: 0.7 },
			}),
		});
		if (!res.ok) throw new Error(`Ollama respondió ${res.status}: ${await res.text()}`);
		const data = (await res.json()) as { message: { content: string } };
		return data.message.content;
	}
}

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
const llmScene = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("kinetic-text"),
		narration: z.string().min(1),
		lines: z
			.array(z.object({ text: z.string().min(1).max(30), emphasis: z.boolean() }))
			.min(1)
			.max(3),
	}),
	z.object({
		type: z.literal("stat"),
		narration: z.string().min(1),
		value: z.number(),
		suffix: z.string().max(8),
		label: z.string().min(1).max(40),
	}),
]);

const llmOutput = (range: [number, number]) =>
	z.object({
		title: z.string().min(1).max(60),
		scenes: z.array(llmScene).min(range[0]).max(range[1]),
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
- Duración objetivo: ${opts.seconds} segundos de narración en total (unas ${Math.round(opts.seconds * WORDS_PER_SECOND)} palabras).
- Entre ${min} y ${max} escenas. La primera es un gancho; la última, un cierre memorable.
- "narration": lo que dice la voz en esa escena, 1 o 2 frases completas.
  Escribe TODOS los números con letras (p. ej. "ocho minutos", nunca "8 minutos").
- Escena "kinetic-text": "lines" son 1 a 3 trozos MUY cortos (máx. 4 palabras cada uno) que resumen
  visualmente la narración. Marca con "emphasis": true solo la palabra clave (como mucho una línea).
- Escena "stat": úsala cuando haya una cifra clave. "value" es el número en cifras, "suffix" su unidad
  corta (" min", "%", " km"…; puede ser ""), y "label" una frase corta que explica la cifra.
- Usa al menos una escena "stat" si el tema tiene datos numéricos.
- Solo hechos verificables y ampliamente aceptados. Si no estás seguro de una cifra, no la uses.
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
	const schema = llmOutput(sceneRange(opts.seconds));
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
					scene.type === "stat"
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
									lines: scene.lines.map((l) => (l.emphasis ? l : { text: l.text })),
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

import { z } from "zod";
import { modelLabel } from "../ai/catalog";
import { isCopiedLine, REPEAT_THRESHOLD, similarity } from "./quality";
import { type Script, sceneRange, scriptSchema, WORDS_PER_SECOND } from "./script";
import { type ScriptTemplate, scriptTemplate } from "./templates";

// Generación del guion con un LLM. El proveedor es intercambiable: Ollama aquí; Claude, OpenAI y
// Gemini en src/ai/providers.

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

export type LlmOptions = {
	signal?: AbortSignal;
	/** Razonar antes de responder (modelos que lo admiten, como Qwen3). Más lento. */
	think?: boolean;
	temperature?: number;
};

export interface LlmProvider {
	readonly name: string;
	/** Devuelve texto JSON que cumple `jsonSchema`. */
	generateJson(messages: LlmMessage[], jsonSchema: object, options?: LlmOptions): Promise<string>;
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
	visual: z.enum(["texto", "cifra", "pasos", "linea", "comparacion", "grafico"]),
	lines: z.array(z.object({ text: z.string(), emphasis: z.boolean() })),
	value: z.number(),
	suffix: z.string(),
	label: z.string(),
	/** Elementos de pasos, línea de tiempo, comparación y gráfico (vacío en texto y cifra). */
	items: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
});

/** Cuántos elementos admite cada tipo con elementos. */
const ITEM_RANGE = { pasos: [2, 4], linea: [2, 4], comparacion: [2, 2], grafico: [2, 5] } as const;
const isListVisual = (v: string): v is keyof typeof ITEM_RANGE => v in ITEM_RANGE;
/** "1.200,5" o "1200.5" → 1200.5 (los valores de un gráfico llegan como texto). */
const parseAmount = (text: string) => {
	const clean = text.trim().replace(/\s/g, "");
	const normalized = /,\d{1,2}$/.test(clean)
		? clean.replace(/\./g, "").replace(",", ".")
		: clean.replace(/,/g, "");
	const n = Number.parseFloat(normalized);
	return Number.isFinite(n) ? n : null;
};

export const LIMITS = { line: 30, lines: 3, title: 60, suffix: 8, label: 40 } as const;
/** Margen aceptado sobre la duración pedida (la IA no cuenta palabras con precisión). */
export const DURATION_TOLERANCE = { min: 0.75, max: 1.35 } as const;

const llmOutput = (range: [number, number]) =>
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
				if (isListVisual(scene.visual)) {
					const [min, max] = ITEM_RANGE[scene.visual];
					const items = scene.items.filter((it) => it.label.trim());
					if (items.length < min || items.length > max)
						problem(
							i,
							min === max
								? `una escena "${scene.visual}" necesita exactamente ${min} elementos en "items".`
								: `una escena "${scene.visual}" necesita de ${min} a ${max} elementos en "items".`,
						);
					for (const it of items) {
						if (it.label.length > LIMITS.label)
							problem(
								i,
								`el elemento "${it.label}" es demasiado largo (máx. ${LIMITS.label} caracteres).`,
							);
						if (scene.visual === "linea" && !it.value.trim())
							problem(
								i,
								'en una "linea", cada elemento necesita "value" con el cuándo (año, siglo, hora…).',
							);
						if (scene.visual === "linea" && it.value.length > 16)
							problem(i, 'en una "linea", "value" es el cuándo, corto (máx. 16 caracteres).');
						if (scene.visual === "grafico" && parseAmount(it.value) === null)
							problem(i, `en un "grafico", "value" es un número ("${it.value}" no lo es).`);
					}
				}
				if (scene.visual === "cifra") {
					if (!scene.label.trim() || TECHNICAL_WORDS.test(scene.label.trim()))
						problem(i, 'en una escena "cifra", "label" es una frase corta que explica el número.');
					if (scene.value === 0)
						problem(i, 'una escena "cifra" necesita un número real en "value".');
				}
			});
			if (out.scenes.filter((s) => s.visual !== "texto" && s.visual !== "cifra").length > 2)
				ctx.addIssue({
					code: "custom",
					message:
						'Usa "pasos", "linea", "comparacion" o "grafico" como mucho en dos escenas; el resto, "texto" (y "cifra" si hay datos).',
					path: ["scenes"],
				});
			if (out.scenes.every((s) => s.visual === "cifra"))
				ctx.addIssue({
					code: "custom",
					message: 'Usa "cifra" solo para datos numéricos; el resto de escenas deben ser "texto".',
					path: ["scenes"],
				});
		});

type LlmScript = z.infer<ReturnType<typeof llmOutput>>;

/**
 * Mejoras deseables (no bloquean): duración, líneas copiadas de la narración e ideas repetidas.
 * Se piden una vez; si el modelo no lo consigue, se usa el mejor intento válido.
 * Hacerlas obligatorias hundía la fiabilidad (evaluación en docs/04-guion-ia.md).
 */
export const softProblems = (
	out: LlmScript,
	seconds: number,
	template?: ScriptTemplate,
): string[] => {
	const problems: string[] = [];
	if (template?.requires && !out.scenes.some((s) => s.visual === template.requires))
		problems.push(
			`La estructura «${template.name}» pide una escena "${template.requires}"; conviértelo en una escena de ese tipo donde encaje.`,
		);
	const words = out.scenes.reduce((t, s) => t + s.narration.trim().split(/\s+/).length, 0);
	const estimated = Math.round(words / WORDS_PER_SECOND);
	if (estimated < seconds * DURATION_TOLERANCE.min)
		problems.push(
			`El guion dura unos ${estimated} s y el objetivo son ${seconds} s (unas ${Math.round(seconds * WORDS_PER_SECOND)} palabras de narración en total). Alarga las narraciones con información nueva, sin repetir datos.`,
		);
	if (estimated > seconds * DURATION_TOLERANCE.max)
		problems.push(
			`El guion dura unos ${estimated} s y el objetivo son ${seconds} s. Acorta las narraciones.`,
		);
	out.scenes.forEach((scene, i) => {
		if (scene.visual !== "texto") return;
		const copied = scene.lines.find((l) => isCopiedLine(l.text, scene.narration));
		if (copied)
			problems.push(
				`Escena ${i + 1}: la línea "${copied.text}" copia la narración; resume la idea con otras palabras (2 a 4).`,
			);
	});
	out.scenes.forEach((a, i) => {
		out.scenes.slice(i + 1).forEach((b, k) => {
			if (similarity(a.narration, b.narration) >= REPEAT_THRESHOLD)
				problems.push(
					`Escena ${i + 2 + k}: repite la idea de la escena ${i + 1}; cámbiala por un dato o una idea nueva.`,
				);
		});
	});
	return problems;
};

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
			items: [],
		},
		{
			narration: "Cada litro de agua de mar lleva unos treinta y cinco gramos de sal disuelta.",
			visual: "cifra",
			lines: [],
			value: 35,
			suffix: " g",
			label: "de sal por litro",
			items: [],
		},
		{
			narration:
				"La lluvia disuelve minerales de las rocas, los ríos los arrastran y en el mar se quedan cuando el agua se evapora.",
			visual: "pasos",
			lines: [],
			value: 0,
			suffix: "",
			label: "Cómo llega la sal",
			items: [
				{ label: "La lluvia disuelve rocas", value: "" },
				{ label: "Los ríos la arrastran", value: "" },
				{ label: "El sol evapora el agua", value: "" },
			],
		},
	],
});

const LANGUAGE_NAMES: Record<string, string> = { es: "español", en: "inglés" };

export const scriptSystemPrompt = (opts: {
	tone: string;
	language: string;
	seconds: number;
	channel?: string;
	template?: ScriptTemplate;
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
- Otros visuales, solo si la escena encaja de verdad (como mucho dos escenas de estos tipos):
  - "pasos": un proceso o una lista; "items" son 2 a 4 pasos MUY cortos ("label"; "value": "");
    "label" de la escena es un título corto o "".
  - "linea": algo que cambió con el tiempo; "items" son 2 a 4 hitos: "value" el cuándo ("1969",
    "hace 4.500 millones de años") y "label" qué pasó.
  - "comparacion": dos cosas frente a frente; "items" son exactamente 2: "label" cada una y "value"
    un detalle corto que las diferencie (o "").
  - "grafico": varias cantidades comparables; "items" son 2 a 5 barras: "label" y "value" el número
    en cifras; "suffix" la unidad; "label" de la escena es el título del gráfico.
  En "texto" y "cifra", deja "items": [].
- Usa "cifra" en una o dos escenas si el tema tiene datos numéricos; el resto, "texto".
- Cada escena aporta algo nuevo: no repitas un dato ni una idea que ya dijiste.
- Las "lines" resumen la idea de su narración con otras palabras; no copies trozos de la frase.
- Solo hechos verificables y ampliamente aceptados. Si no estás seguro de una cifra, no la uses.
${
	opts.template?.guide
		? `Estructura del video («${opts.template.name}»), síguela escena a escena:\n${opts.template.guide}\n`
		: ""
}Ejemplo de la forma (sobre otro tema, más corto):
${EXAMPLE}

Responde solo con el JSON pedido.`;
};

export const MAX_ATTEMPTS = 3;

type LlmScene = LlmScript["scenes"][number];

const contentFromLlm = (scene: LlmScene): Script["scenes"][number]["content"] => {
	const items = scene.items.filter((it) => it.label.trim());
	const title = scene.label.trim() || undefined;
	switch (scene.visual) {
		case "cifra":
			return {
				type: "stat",
				value: scene.value,
				suffix: scene.suffix || undefined,
				label: scene.label,
			};
		case "pasos":
			return { type: "steps", title, items: items.map((it) => it.label.trim()) };
		case "linea":
			return {
				type: "timeline",
				title,
				events: items.map((it) => ({ when: it.value.trim(), label: it.label.trim() })),
			};
		case "comparacion":
			return {
				type: "compare",
				title,
				items: items.map((it) => ({
					label: it.label.trim(),
					detail: it.value.trim() || undefined,
				})),
			};
		case "grafico":
			return {
				type: "chart",
				title,
				suffix: scene.suffix || undefined,
				bars: items.map((it) => ({ label: it.label.trim(), value: parseAmount(it.value) ?? 0 })),
			};
		default:
			return {
				type: "kinetic-text",
				lines: scene.lines
					.filter((l) => l.text.trim())
					.map((l) => (l.emphasis ? l : { text: l.text })),
			};
	}
};

const fromLlm = (out: LlmScript): Script =>
	scriptSchema.parse({
		title: out.title,
		scenes: out.scenes.map((scene) => ({
			narration: scene.narration,
			content: contentFromLlm(scene),
		})),
	});

const toLlm = (script: Script) => ({
	title: script.title,
	scenes: script.scenes.map((scene) => {
		const c = scene.content;
		const base = {
			narration: scene.narration,
			lines: [],
			value: 0,
			suffix: "",
			label: "",
			items: [],
		};
		switch (c.type) {
			case "stat":
				return { ...base, visual: "cifra", value: c.value, suffix: c.suffix ?? "", label: c.label };
			case "steps":
				return {
					...base,
					visual: "pasos",
					label: c.title ?? "",
					items: c.items.map((label) => ({ label, value: "" })),
				};
			case "timeline":
				return {
					...base,
					visual: "linea",
					label: c.title ?? "",
					items: c.events.map((e) => ({ label: e.label, value: e.when })),
				};
			case "compare":
				return {
					...base,
					visual: "comparacion",
					label: c.title ?? "",
					items: c.items.map((it) => ({ label: it.label, value: it.detail ?? "" })),
				};
			case "chart":
				return {
					...base,
					visual: "grafico",
					label: c.title ?? "",
					suffix: c.suffix ?? "",
					items: c.bars.map((b) => ({ label: b.label, value: String(b.value) })),
				};
			default:
				return {
					...base,
					visual: "texto",
					lines: c.lines.map((l) => ({ text: l.text, emphasis: Boolean(l.emphasis) })),
				};
		}
	}),
});

const isAborted = (options: LlmOptions) => Boolean(options.signal?.aborted);

/** Cuántas veces se pide mejorar un guion ya válido (cada intento cuesta ~40 s). */
export const SOFT_RETRIES = 1;

/**
 * Pide el guion hasta que cumple el esquema (errores graves: se reintenta hasta MAX_ATTEMPTS).
 * Con un guion válido, pide como mucho SOFT_RETRIES mejoras y se queda con el mejor intento.
 */
async function askScript(
	llm: LlmProvider,
	messages: LlmMessage[],
	schema: ReturnType<typeof llmOutput>,
	seconds: number,
	options: LlmOptions,
	template?: ScriptTemplate,
): Promise<{ script: Script; attempts: number; softProblems: string[] }> {
	let lastProblem = "";
	let best: { script: Script; softProblems: string[] } | null = null;
	let softRetries = 0;
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		const raw = await llm.generateJson(messages, z.toJSONSchema(schema), options);
		let feedback: string;
		try {
			const out = schema.parse(JSON.parse(raw));
			const soft = softProblems(out, seconds, template);
			if (!best || soft.length < best.softProblems.length)
				best = { script: fromLlm(out), softProblems: soft };
			if (soft.length === 0 || softRetries >= SOFT_RETRIES) {
				return { ...best, attempts: attempt };
			}
			softRetries++;
			feedback = `El JSON es válido, pero mejóralo:\n${soft.map((p) => `- ${p}`).join("\n")}\nResponde de nuevo con el guion completo.`;
		} catch (error) {
			if (isAborted(options)) throw error;
			lastProblem = error instanceof z.ZodError ? z.prettifyError(error) : String(error);
			feedback = `Tu JSON no es válido:\n${lastProblem}\nCorrígelo y responde de nuevo.`;
		}
		messages.push({ role: "assistant", content: raw }, { role: "user", content: feedback });
	}
	if (best) return { ...best, attempts: MAX_ATTEMPTS };
	throw new Error(`La IA no produjo un guion válido tras ${MAX_ATTEMPTS} intentos: ${lastProblem}`);
}

export const reviewSystemPrompt = (opts: { language: string; seconds: number }) =>
	`Eres editor y verificador de datos de videos divulgativos cortos.
Recibes un guion en JSON. Devuelve el MISMO formato con el guion mejorado. Revisa, en este orden:
1. Datos: corrige lo que sea falso o impreciso. Si dudas de una afirmación o una cifra, generalízala o quítala.
2. Repeticiones: si dos escenas dicen lo mismo, cambia una por una idea o un dato nuevo del tema.
3. "lines": deben RESUMIR la narración con otras palabras (2 a 4 palabras por línea), no copiar trozos de ella.
4. Ortografía y naturalidad en ${LANGUAGE_NAMES[opts.language] ?? opts.language}; números de la narración con letras.
5. Mantén la duración: unas ${Math.round(opts.seconds * WORDS_PER_SECOND)} palabras de narración en total, y el gancho al principio.
Responde solo con el JSON.`;

export type ScriptQualityOptions = {
	/** Razonar antes de escribir (modo "pensar" del modelo). Más lento. */
	think?: boolean;
	/** Segunda pasada: la IA revisa datos, repeticiones y estilo de su borrador. */
	review?: boolean;
};

/**
 * Configuración por defecto, elegida con la evaluación de docs/04-guion-ia.md (Qwen3 8B):
 * "pensar" fue la única fiable en las dos rondas (8/8) y la de mejores datos; la revisión
 * no corrige errores con un modelo pequeño (a veces añade otros), así que queda desactivada.
 */
export const DEFAULT_SCRIPT_QUALITY: ScriptQualityOptions = { review: false, think: true };

export type GenerateScriptOptions = {
	topic: string;
	tone: string;
	language: string;
	seconds: number;
	channel?: string;
	/** Plantilla de estructura (ver templates.ts); sin ella, libre. */
	template?: string;
	signal?: AbortSignal;
	quality?: ScriptQualityOptions;
	onStage?: (stage: "draft" | "review") => void;
};

/** Escribe el guion con la IA (borrador y, si se pide, revisión). Devuelve también cuántas llamadas hizo. */
export async function generateScriptWithStats(
	llm: LlmProvider,
	opts: GenerateScriptOptions,
): Promise<{ script: Script; calls: number; reviewed: boolean; softProblems: string[] }> {
	const quality = { ...DEFAULT_SCRIPT_QUALITY, ...opts.quality };
	const schema = llmOutput(sceneRange(opts.seconds));
	const options: LlmOptions = { signal: opts.signal, think: quality.think };
	const template = scriptTemplate(opts.template);

	opts.onStage?.("draft");
	const draft = await askScript(
		llm,
		[
			{ role: "system", content: scriptSystemPrompt({ ...opts, template }) },
			{ role: "user", content: `Tema del video: ${opts.topic}` },
		],
		schema,
		opts.seconds,
		options,
		template,
	);
	if (!quality.review)
		return {
			script: draft.script,
			calls: draft.attempts,
			reviewed: false,
			softProblems: draft.softProblems,
		};

	opts.onStage?.("review");
	try {
		const reviewed = await askScript(
			llm,
			[
				{ role: "system", content: reviewSystemPrompt(opts) },
				{
					role: "user",
					content: `Tema: ${opts.topic}\n\nGuion:\n${JSON.stringify(toLlm(draft.script))}`,
				},
			],
			schema,
			opts.seconds,
			{ ...options, temperature: 0.3 },
		);
		return {
			script: reviewed.script,
			calls: draft.attempts + reviewed.attempts,
			reviewed: true,
			softProblems: reviewed.softProblems,
		};
	} catch (error) {
		if (opts.signal?.aborted) throw error;
		// Si la revisión no sale bien, el borrador ya era válido: mejor eso que nada.
		return {
			script: draft.script,
			calls: draft.attempts + MAX_ATTEMPTS,
			reviewed: false,
			softProblems: draft.softProblems,
		};
	}
}

/** Pide el guion a la IA; si la respuesta no es válida, le devuelve el error para que se corrija. */
export async function generateScript(
	llm: LlmProvider,
	opts: GenerateScriptOptions,
): Promise<Script> {
	return (await generateScriptWithStats(llm, opts)).script;
}

/** Proveedor local con Ollama (salida estructurada con JSON Schema). */
export class OllamaProvider implements LlmProvider {
	readonly name: string;

	constructor(
		private readonly model: string,
		private readonly baseUrl = "http://localhost:11434",
	) {
		this.name = `${modelLabel("ollama", model)} (en este equipo)`;
	}

	/** Modelos instalados, o null si Ollama no está en marcha. */
	async installedModels(): Promise<string[] | null> {
		try {
			const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
			const data = (await res.json()) as { models?: { name: string }[] };
			return (data.models ?? []).map((m) => m.name);
		} catch {
			return null;
		}
	}

	async status(): Promise<LlmStatus> {
		const models = await this.installedModels();
		if (models === null)
			return {
				available: false,
				name: this.name,
				reason: "Ollama no está en marcha en este equipo.",
			};
		const installed = models.some((m) => m === this.model || m === `${this.model}:latest`);
		return installed
			? { available: true, name: this.name }
			: {
					available: false,
					name: this.name,
					reason: `El modelo ${modelLabel("ollama", this.model)} no está descargado. Descárgalo en Ajustes.`,
				};
	}

	async generateJson(
		messages: LlmMessage[],
		jsonSchema: object,
		options: LlmOptions = {},
	): Promise<string> {
		const res = await fetch(`${this.baseUrl}/api/chat`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			signal: options.signal,
			body: JSON.stringify({
				model: this.model,
				messages,
				format: jsonSchema,
				stream: false,
				think: options.think ?? false,
				options: { temperature: options.temperature ?? 0.7 },
			}),
		});
		if (!res.ok) throw new Error(`Ollama respondió ${res.status}: ${await res.text()}`);
		const data = (await res.json()) as { message: { content: string } };
		return data.message.content;
	}
}

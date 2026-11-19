import { z } from "zod";
import { LIMITS, type LlmMessage, type LlmOptions, type LlmProvider, MAX_ATTEMPTS } from "./ai";
import type { Script } from "./script";

// «Revisar guion» con IA: un editor exigente lee el guion guardado y devuelve un veredicto, lo que
// conviene conservar y pocos cambios de alto impacto (frase → problema → ajuste), con la narración
// reescrita cuando el cambio se puede aplicar con un clic.
// Criterios inspirados en la skill «cuestionar-guion» de skills-videos-cortos (JustCarlos30, MIT):
// promesa y entrega, comprensión desde cero, progresión, credibilidad y cierre; sin elogios de
// compromiso, sin notas numéricas ni promesas de viralidad. El texto del prompt es nuestro.

export const REVIEW_ASPECTS = [
	"gancho",
	"promesa",
	"claridad",
	"progresion",
	"dato",
	"cierre",
	"estilo",
] as const;
export type ReviewAspect = (typeof REVIEW_ASPECTS)[number];

export const REVIEW_ASPECT_LABELS: Record<ReviewAspect, string> = {
	gancho: "Gancho",
	promesa: "Promesa y entrega",
	claridad: "Claridad",
	progresion: "Progresión",
	dato: "Dato",
	cierre: "Cierre",
	estilo: "Estilo",
};

export const MAX_SUGGESTIONS = 5;

export type ReviewSuggestion = {
	/** Escena (0 = la primera); null = afecta a todo el video. */
	scene: number | null;
	aspect: ReviewAspect;
	/** Frase o tramo del guion al que se refiere ("" si es general). */
	quote: string;
	problem: string;
	change: string;
	/** Narración nueva de la escena, si el cambio se aplica reescribiéndola. */
	narration?: string;
	/** Texto en pantalla nuevo (solo escenas de texto). */
	lines?: { text: string; emphasis?: boolean }[];
};

export type ScriptReview = {
	verdict: string;
	keep: string[];
	suggestions: ReviewSuggestion[];
};

// Formato plano para la IA (ver ai.ts: con salida restringida, las uniones confunden a los modelos
// pequeños). Las reglas se validan después y el error se le devuelve para que corrija.
const llmSuggestion = z.object({
	scene: z.number().int(),
	aspect: z.enum(REVIEW_ASPECTS),
	quote: z.string(),
	problem: z.string().min(1),
	change: z.string().min(1),
	narration: z.string(),
	lines: z.array(z.string()),
	emphasis: z.number().int(),
});

const llmReview = (script: Script) =>
	z
		.object({
			verdict: z.string().min(1),
			keep: z.array(z.string()),
			suggestions: z.array(llmSuggestion).min(1).max(MAX_SUGGESTIONS),
		})
		.superRefine((out, ctx) => {
			const issue = (message: string, path: (string | number)[]) =>
				ctx.addIssue({ code: "custom", message, path });
			if (out.keep.length > 3) issue("«keep» admite como mucho 3 cosas.", ["keep"]);
			out.suggestions.forEach((s, i) => {
				const at = ["suggestions", i];
				const scene = script.scenes[s.scene - 1];
				if (s.scene < 0 || s.scene > script.scenes.length)
					issue(
						`"scene" debe ser de 1 a ${script.scenes.length} (o 0 si afecta a todo el video).`,
						[...at, "scene"],
					);
				if (s.narration.trim()) {
					if (!scene)
						issue('Una narración nueva necesita "scene" de una escena concreta.', [...at, "scene"]);
					if (/\d/.test(s.narration))
						issue("Escribe los números de la narración con letras.", [...at, "narration"]);
					if (scene) {
						const before = words(scene.narration);
						const after = words(s.narration);
						if (after > Math.max(before * 1.8, before + 14))
							issue(
								`La narración nueva es mucho más larga que la original (${after} palabras frente a ${before}).`,
								[...at, "narration"],
							);
					}
				}
				if (s.lines.length > 0) {
					if (scene?.content.type !== "kinetic-text")
						issue('"lines" solo vale para escenas de texto; déjalo vacío ([]).', [...at, "lines"]);
					if (s.lines.length > LIMITS.lines)
						issue(`Como mucho ${LIMITS.lines} líneas.`, [...at, "lines"]);
					s.lines.forEach((line, j) => {
						if (line.trim().length > LIMITS.line)
							issue(`La línea «${line}» es demasiado larga (máx. ${LIMITS.line} caracteres).`, [
								...at,
								"lines",
								j,
							]);
					});
				}
			});
		});
type LlmReview = z.infer<ReturnType<typeof llmReview>>;

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

const LANGUAGE_NAMES: Record<string, string> = { es: "español", en: "inglés" };

export const reviewPrompt = (opts: { language: string; tone: string; channel?: string }) =>
	`Eres un editor exigente de guiones para videos cortos verticales (TikTok, Reels, Shorts)${
		opts.channel ? ` del canal "${opts.channel}"` : ""
	}.
Ayudas al autor a decidir qué conservar y qué cambiar ANTES de poner la voz. Critica con franqueza
y con evidencia: sin elogios de compromiso y sin inventar problemas.
Escribe en ${LANGUAGE_NAMES[opts.language] ?? opts.language}. Tono de la marca (respétalo): ${opts.tone}

Úsalas como lentes (no hace falta responderlas todas):
- Promesa y entrega: ¿qué espera recibir quien escucha la primera escena? ¿Dónde lo recibe? Si el
  video no entrega lo que promete, dilo citando los dos tramos.
- Comprensión desde cero: ¿lo entiende alguien que no conoce el canal? Jerga, "esto" sin referencia,
  saltos sin conexión.
- Progresión: ¿cada escena aporta algo nuevo y acerca a la respuesta? Di en qué escena se cae el
  interés y por qué.
- Concreción y credibilidad: ¿hay un ejemplo o un dato que se recuerde? Señala las afirmaciones o
  cifras dudosas. Nunca inventes cifras para mejorar el gancho.
- Cierre: ¿resuelve la pregunta del principio? ¿Qué se lleva quien lo ve? Pedir comentarios no
  sustituye a la respuesta.

Responde un JSON con:
- "verdict": 1 o 2 frases con el veredicto franco (el problema o la fortaleza dominante).
- "keep": 0 a 3 cosas que funcionan y conviene conservar (frases cortas).
- "suggestions": de 1 a ${MAX_SUGGESTIONS} cambios, los de MAYOR impacto primero. Cada uno con:
  - "scene": número de la escena (1 = la primera), o 0 si afecta a todo el video;
  - "aspect": "gancho", "promesa", "claridad", "progresion", "dato", "cierre" o "estilo";
  - "quote": la frase exacta del guion a la que te refieres ("" si es general);
  - "problem": qué falla y qué efecto probable tiene en quien lo ve;
  - "change": el ajuste concreto que propones;
  - "narration": la narración COMPLETA nueva de esa escena si el cambio se aplica reescribiéndola,
    o "" si no. Conserva la voz y el humor del autor, una longitud parecida y los números con letras;
  - "lines": si cambias una escena de texto, 1 a 3 trozos MUY cortos (máx. 4 palabras) que la
    resuman en pantalla; [] para dejarlos como están;
  - "emphasis": índice (0, 1 o 2) de la línea clave de "lines", o -1.
Prioriza pocos cambios que de verdad mejoren el video. Si el guion ya funciona, dilo y propón poco.
Nada de notas numéricas, porcentajes inventados, promesas de viralidad ni consejos vacíos como
"más ritmo" o "más gancho".
Responde solo con el JSON.`;

/** El guion tal como lo lee el editor: escenas numeradas con su narración y lo que se ve. */
export const scriptForReview = (topic: string, script: Script) =>
	`Tema del video: ${topic}\nTítulo: ${script.title}\n\n${script.scenes
		.map((scene, i) => {
			const visual =
				scene.content.type === "stat"
					? `cifra en pantalla: ${scene.content.value}${scene.content.suffix ?? ""} — ${scene.content.label}`
					: `texto en pantalla: ${scene.content.lines.map((l) => `«${l.text}»`).join(" / ")}`;
			return `Escena ${i + 1} (${visual})\nNarración: ${scene.narration}`;
		})
		.join("\n\n")}`;

const fromLlm = (out: LlmReview, script: Script): ScriptReview => ({
	verdict: out.verdict.trim(),
	keep: out.keep.map((k) => k.trim()).filter(Boolean),
	suggestions: out.suggestions.map((s) => {
		const scene = s.scene >= 1 ? s.scene - 1 : null;
		const lines = s.lines.map((l) => l.trim()).filter(Boolean);
		const isText = scene !== null && script.scenes[scene]?.content.type === "kinetic-text";
		return {
			scene,
			aspect: s.aspect,
			quote: s.quote.trim(),
			problem: s.problem.trim(),
			change: s.change.trim(),
			...(scene !== null && s.narration.trim() ? { narration: s.narration.trim() } : {}),
			...(isText && lines.length > 0
				? {
						lines: lines.map((text, j) => (j === s.emphasis ? { text, emphasis: true } : { text })),
					}
				: {}),
		};
	}),
});

export type ReviewScriptOptions = {
	topic: string;
	tone: string;
	language: string;
	channel?: string;
	signal?: AbortSignal;
	/** Razonar antes de responder (mejor crítica, más lento). */
	think?: boolean;
};

/** Pide la revisión; si la respuesta no es válida, le devuelve el error a la IA (hasta 3 intentos). */
export async function reviewScript(
	llm: LlmProvider,
	script: Script,
	opts: ReviewScriptOptions,
): Promise<ScriptReview> {
	const schema = llmReview(script);
	const options: LlmOptions = { signal: opts.signal, think: opts.think ?? true, temperature: 0.4 };
	const messages: LlmMessage[] = [
		{ role: "system", content: reviewPrompt(opts) },
		{ role: "user", content: scriptForReview(opts.topic, script) },
	];
	let last = "";
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		const raw = await llm.generateJson(messages, z.toJSONSchema(schema), options);
		try {
			return fromLlm(schema.parse(JSON.parse(raw)), script);
		} catch (error) {
			if (opts.signal?.aborted) throw error;
			last = error instanceof z.ZodError ? z.prettifyError(error) : String(error);
			messages.push(
				{ role: "assistant", content: raw },
				{ role: "user", content: `Tu JSON no es válido:\n${last}\nCorrígelo y responde de nuevo.` },
			);
		}
	}
	throw new Error(`La IA no produjo una revisión válida tras ${MAX_ATTEMPTS} intentos: ${last}`);
}

type SceneLike = {
	narration: string;
	content:
		| { type: "kinetic-text"; lines: { text: string; emphasis?: boolean }[] }
		| { type: "stat"; value: number; suffix?: string; label: string };
};

/** ¿La propuesta se puede aplicar con un clic? */
export const canApply = (s: ReviewSuggestion) =>
	s.scene !== null && Boolean(s.narration || s.lines);

/** El guion con la propuesta aplicada (narración y, en escenas de texto, el texto en pantalla). */
export function applySuggestion<T extends { scenes: SceneLike[] }>(
	script: T,
	s: ReviewSuggestion,
): T {
	if (s.scene === null || !script.scenes[s.scene]) return script;
	return {
		...script,
		scenes: script.scenes.map((scene, i) => {
			if (i !== s.scene) return scene;
			return {
				...scene,
				narration: s.narration ?? scene.narration,
				content:
					s.lines && scene.content.type === "kinetic-text"
						? { ...scene.content, lines: s.lines }
						: scene.content,
			};
		}),
	};
}

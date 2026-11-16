/**
 * Tema → storyboard JSON (→ voz → video).
 *
 *   pnpm ai "por qué el cielo es azul" --preset ciencia --lang es --duration 45 [--render]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { z } from "zod/v4";
import { type Storyboard, storyboardSchema } from "../src/storyboard/schema";
import { type LlmMessage, type LlmProvider, OllamaProvider } from "./llm";
import { type NichePreset, PRESETS, type PresetId } from "./presets";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORDS_PER_SECOND = 2.6; // ritmo aproximado de la voz; tts/generate.py ajusta luego al audio real
const MAX_ATTEMPTS = 3;

// Lo ÚNICO que escribe la IA. Colores, voz, formato… salen del preset.
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

const llmOutput = (minScenes: number, maxScenes: number) =>
	z.object({
		title: z.string().min(1).max(60),
		scenes: z.array(llmScene).min(minScenes).max(maxScenes),
	});

const LANGUAGE_NAMES: Record<string, string> = { es: "español", en: "inglés" };

const systemPrompt = (tone: string, language: string, seconds: number, scenes: [number, number]) =>
	`Eres guionista de videos verticales informativos para TikTok, Reels y Shorts.
Escribe en ${LANGUAGE_NAMES[language] ?? language}. Tono: ${tone}

Reglas:
- Duración objetivo: ${seconds} segundos de narración en total (unas ${Math.round(seconds * WORDS_PER_SECOND)} palabras).
- Entre ${scenes[0]} y ${scenes[1]} escenas. La primera es un gancho; la última, un cierre memorable.
- "narration": lo que dice la voz en esa escena, 1 o 2 frases completas.
  Escribe TODOS los números con letras (p. ej. "ocho minutos", nunca "8 minutos").
- Escena "kinetic-text": "lines" son 1 a 3 trozos MUY cortos (máx. 4 palabras cada uno) que resumen
  visualmente la narración. Marca con "emphasis": true solo la palabra clave (como mucho una línea).
- Escena "stat": úsala cuando haya una cifra clave. "value" es el número en cifras, "suffix" su unidad
  corta (" min", "%", " km"…; puede ser ""), y "label" una frase corta que explica la cifra.
- Usa al menos una escena "stat" si el tema tiene datos numéricos.
- Solo hechos verificables y ampliamente aceptados. Si no estás seguro de una cifra, no la uses.
Responde solo con el JSON pedido.`;

const slugify = (text: string) =>
	text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 50);

export async function generateStoryboard(
	topic: string,
	opts: { preset: PresetId; language: string; seconds: number },
	llm: LlmProvider = new OllamaProvider(),
): Promise<Storyboard> {
	const preset: NichePreset = PRESETS[opts.preset];
	const sceneRange: [number, number] = [
		Math.max(3, Math.floor(opts.seconds / 7)),
		Math.max(4, Math.ceil(opts.seconds / 3.5)),
	];
	const schema = llmOutput(...sceneRange);
	const messages: LlmMessage[] = [
		{ role: "system", content: systemPrompt(preset.tone, opts.language, opts.seconds, sceneRange) },
		{ role: "user", content: `Tema del video: ${topic}` },
	];

	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		const raw = await llm.generateJson(messages, z.toJSONSchema(schema));
		let problem: string;
		try {
			const content = schema.parse(JSON.parse(raw));
			// Unimos contenido de la IA + decisiones del preset y validamos con el contrato real.
			return storyboardSchema.parse({
				title: content.title,
				language: opts.language,
				format: "9:16",
				fps: 30,
				voice: { voiceId: preset.voices[opts.language] ?? preset.voices.en, speed: preset.speed },
				captions: { enabled: true, maxWordsPerPage: 4 },
				theme: preset.theme,
				scenes: content.scenes.map((scene) => ({
					...scene,
					// Estimación inicial; tts/generate.py la ajusta a la duración real de la voz.
					durationInSeconds: Math.max(
						2.5,
						Math.round((scene.narration.split(/\s+/).length / WORDS_PER_SECOND) * 10) / 10,
					),
				})),
			});
		} catch (error) {
			problem = error instanceof z.ZodError ? z.prettifyError(error) : String(error);
		}
		console.warn(`Intento ${attempt}: respuesta inválida.\n${problem}`);
		// Le devolvemos el error a la IA para que se corrija.
		messages.push(
			{ role: "assistant", content: raw },
			{ role: "user", content: `Tu JSON no es válido:\n${problem}\nCorrígelo y responde de nuevo.` },
		);
	}
	throw new Error(`La IA no produjo un storyboard válido tras ${MAX_ATTEMPTS} intentos`);
}

async function main() {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: {
			preset: { type: "string", default: "curiosidades" },
			lang: { type: "string", default: "es" },
			duration: { type: "string", default: "40" },
			render: { type: "boolean", default: false },
		},
	});
	const topic = positionals.join(" ").trim();
	const preset = values.preset as PresetId;
	if (!topic || !(preset in PRESETS)) {
		console.error(
			`Uso: pnpm ai "tema" [--preset ${Object.keys(PRESETS).join("|")}] [--lang es|en] [--duration 40] [--render]`,
		);
		process.exit(1);
	}

	const started = Date.now();
	const llm = new OllamaProvider();
	console.log(`Generando con ${llm.name} (${PRESETS[preset].label}, ${values.lang})…`);
	const storyboard = await generateStoryboard(
		topic,
		{ preset, language: values.lang, seconds: Number(values.duration) },
		llm,
	);

	const slug = slugify(storyboard.title) || "video";
	const storyPath = join(ROOT, "stories", `${slug}.json`);
	mkdirSync(dirname(storyPath), { recursive: true });
	writeFileSync(storyPath, `${JSON.stringify(storyboard, null, "\t")}\n`);
	console.log(`Storyboard: ${storyPath} (${storyboard.scenes.length} escenas, ${((Date.now() - started) / 1000).toFixed(1)}s)`);

	if (values.render) {
		const propsPath = join(ROOT, "out", `${slug}.props.json`);
		const videoPath = join(ROOT, "out", `${slug}.mp4`);
		execFileSync("uv", ["run", "generate.py", storyPath, propsPath], { cwd: join(ROOT, "tts"), stdio: "inherit" });
		execFileSync("pnpm", ["exec", "remotion", "render", "Storyboard", videoPath, `--props=${propsPath}`], {
			cwd: ROOT,
			stdio: "inherit",
		});
		console.log(`Video: ${videoPath}`);
	}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}

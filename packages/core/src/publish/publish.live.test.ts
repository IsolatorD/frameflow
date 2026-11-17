import { arch, platform, totalmem } from "node:os";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defaultLocalModel, systemInfoFrom } from "../ai/catalog";
import { OllamaProvider } from "../script/ai";
import { aiPostsPrompt, aiPostsSchema, postsFromAi } from "./publish";

// Textos de publicación con el modelo real (opcional y lento): FRAMEFLOW_LIVE_AI=1.
const model =
	process.env.FRAMEFLOW_MODEL ??
	defaultLocalModel(systemInfoFrom({ platform: platform(), arch: arch(), totalBytes: totalmem() }));

describe.skipIf(!process.env.FRAMEFLOW_LIVE_AI)("textos de publicación con IA real", () => {
	it("devuelve un texto válido para cada red", { timeout: 900_000 }, async () => {
		const llm = new OllamaProvider(model);
		const started = Date.now();
		const raw = await llm.generateJson(
			aiPostsPrompt({
				title: "Por qué Marte es rojo",
				narrations: [
					"¿Alguna vez te preguntaste por qué Marte parece un planeta rojo?",
					"Su superficie está cubierta de óxido de hierro, la misma herrumbre que en la Tierra.",
					"El polvo rojizo se levanta en tormentas que pueden cubrir todo el planeta durante meses.",
				],
				ctaText: "Síguenos para más datos del espacio",
				hashtags: ["#astronomía", "#espacio"],
				language: "es",
				channel: "Astroinfo",
			}),
			z.toJSONSchema(aiPostsSchema),
			{ think: false, temperature: 0.7 },
		);
		const posts = postsFromAi(aiPostsSchema.parse(JSON.parse(raw)));
		console.log(`${Math.round((Date.now() - started) / 1000)} s`, JSON.stringify(posts, null, 1));
		expect(Object.keys(posts).sort()).toEqual(["facebook", "instagram", "tiktok", "youtube"]);
		expect(posts.youtube?.title.length).toBeGreaterThan(0);
		for (const post of Object.values(posts)) expect(post?.caption.length).toBeGreaterThan(20);
	});
});

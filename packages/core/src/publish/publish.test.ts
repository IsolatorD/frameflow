import { describe, expect, it } from "vitest";
import {
	checkPost,
	composeCaption,
	draftPost,
	exportNotes,
	fileSlug,
	normalizeHashtag,
	postsFromAi,
	publishTarget,
} from "./publish";

const source = {
	title: "Por qué Marte es rojo",
	narrations: [
		"¿Alguna vez te preguntaste por qué Marte es rojo? La respuesta está en su suelo.",
		"Su superficie está cubierta de óxido de hierro.",
	],
	ctaText: "Síguenos para más datos del espacio",
	hashtags: ["#astronomía", "#espacio", "#marte", "#ciencia", "#planetas", "#nasa"],
};
const video = { seconds: 45, format: "9:16" as const, renderUpToDate: true };

describe("exportar para redes", () => {
	it("prepara el texto de cada red con el gancho, la llamada a la acción y los hashtags", () => {
		const yt = draftPost(publishTarget("youtube"), source);
		expect(yt.title).toBe("Por qué Marte es rojo");
		expect(yt.caption).toBe(
			"¿Alguna vez te preguntaste por qué Marte es rojo?\n\nSíguenos para más datos del espacio",
		);
		expect(yt.hashtags).toEqual(["#astronomía", "#espacio", "#marte"]);
		const ig = draftPost(publishTarget("instagram"), source);
		expect(ig.title).toBe("");
		expect(ig.hashtags).toHaveLength(5);
		expect(composeCaption(ig).endsWith("#astronomía #espacio #marte #ciencia #planetas")).toBe(
			true,
		);
	});

	it("normaliza hashtags y nombres de archivo", () => {
		expect(normalizeHashtag(" ##Astronomía! ")).toBe("#Astronomía");
		expect(normalizeHashtag("#")).toBeNull();
		expect(fileSlug("¿Por qué Marte es rojo?")).toBe("por-que-marte-es-rojo");
		expect(fileSlug("¡¿?!")).toBe("video");
	});

	it("avisa de límites, duración, formato y MP4 desactualizado", () => {
		const yt = publishTarget("youtube");
		const ok = draftPost(yt, source);
		expect(checkPost(yt, ok, video)).toEqual([]);
		const issues = checkPost(
			yt,
			{ ...ok, title: "x".repeat(120), hashtags: [...source.hashtags, "#a", "#b"] },
			{ seconds: 200, format: "16:9", renderUpToDate: false },
		);
		expect(issues.map((i) => i.level)).toEqual(["error", "warning", "error", "warning", "warning"]);
		expect(issues[0]?.message).toContain("120 caracteres");
		expect(checkPost(yt, { ...ok, title: "" }, video)[0]?.message).toBe("Falta el título.");
		// Facebook no tiene límite de duración publicado.
		expect(
			checkPost(publishTarget("facebook"), draftPost(publishTarget("facebook"), source), {
				...video,
				seconds: 900,
			}),
		).toEqual([]);
	});

	it("limpia la respuesta de la IA", () => {
		const posts = postsFromAi({
			posts: [
				{
					platform: "youtube",
					title: "x".repeat(150),
					caption: "Marte se oxidó #marte hace millones de años.",
					hashtags: ["Marte", "#espacio", "marte", "planeta rojo", "#ciencia"],
				},
				{ platform: "tiktok", title: "ignorado", caption: "Texto", hashtags: [] },
			],
		});
		expect(posts.youtube?.title).toHaveLength(100);
		expect(posts.youtube?.caption).toBe("Marte se oxidó hace millones de años.");
		expect(posts.youtube?.hashtags).toEqual(["#Marte", "#espacio", "#marte"]);
		expect(posts.tiktok?.title).toBe("");
		// Sin llamada a la acción, la app la añade; si ya estaba, no la repite.
		const withCta = postsFromAi(
			{
				posts: [
					{ platform: "tiktok", title: "", caption: "Corto.", hashtags: [] },
					{ platform: "facebook", title: "", caption: "Hola. ¡Síguenos para más!", hashtags: [] },
				],
			},
			{ ctaText: "Síguenos para más." },
		);
		expect(withCta.tiktok?.caption).toBe("Corto.\n\nSíguenos para más.");
		expect(withCta.facebook?.caption).toBe("Hola. ¡Síguenos para más!");
	});

	it("escribe las notas que acompañan al MP4", () => {
		const yt = publishTarget("youtube");
		const notes = exportNotes(yt, draftPost(yt, source));
		expect(notes).toContain("TÍTULO\nPor qué Marte es rojo");
		expect(notes).toContain("DESCRIPCIÓN");
		expect(notes).toContain("https://studio.youtube.com/");
	});
});

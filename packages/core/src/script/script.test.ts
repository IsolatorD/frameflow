import { describe, expect, it } from "vitest";
import { findClip, storyboardDuration } from "../storyboard/timeline";
import { generateScript, type LlmProvider } from "./ai";
import {
	applyVideoSettings,
	assembleStoryboard,
	estimateSeconds,
	isFullyVoiced,
	scriptFromStoryboard,
	starterScript,
	videoSettingsFromStoryboard,
	voicedSceneIds,
} from "./script";

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
		textScene("¿Sabías que la luz del Sol es del pasado?", "Luz antigua"),
		{
			narration: "Tarda unos ocho minutos en llegar hasta aquí.",
			visual: "cifra",
			lines: [],
			value: 8,
			suffix: " min",
			label: "en llegar",
		},
		textScene("Cada vez que miras al cielo, miras al pasado.", "Viaje en el tiempo"),
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

	it("una línea demasiado larga es un error: se devuelve a la IA, no se corta", async () => {
		const longLine = JSON.stringify({
			title: "Largo",
			scenes: [1, 2, 3].map(() =>
				textScene("Una frase completa de prueba aquí.", "¿Sabías que hay objetos tan fuertes?"),
			),
		});
		const llm = fakeLlm([longLine, validAnswer]);
		const script = await generateScript(llm, { topic: "x", tone: "", language: "es", seconds: 10 });
		expect(JSON.stringify(llm.lastMessages)).toContain("es demasiado larga");
		expect(script.title).toBe("La luz del Sol");
	});

	it("la duración y el estilo se piden una vez; si no mejora, usa el mejor intento", async () => {
		const short = JSON.stringify({
			title: "Corto",
			scenes: [1, 2, 3].map((n) =>
				textScene(`Una frase corta número ${["uno", "dos", "tres"][n - 1]} aquí.`, "Idea"),
			),
		});
		const llm = fakeLlm([short, short, validAnswer]);
		const script = await generateScript(llm, { topic: "x", tone: "", language: "es", seconds: 20 });
		expect(llm.calls).toBe(2); // una sola petición de mejora
		expect(JSON.stringify(llm.lastMessages)).toContain("Alarga las narraciones");
		expect(script.title).toBe("Corto"); // no falla: se queda con el guion válido
	});

	it("con revisión, la segunda pasada mejora el borrador y, si falla, conserva el borrador", async () => {
		const reviewed = JSON.stringify({ ...JSON.parse(validAnswer), title: "Revisado" });
		const ok = await generateScript(fakeLlm([validAnswer, reviewed]), {
			topic: "x",
			tone: "",
			language: "es",
			seconds: 10,
			quality: { review: true },
		});
		expect(ok.title).toBe("Revisado");
		const fallback = await generateScript(fakeLlm([validAnswer, "{}", "{}", "{}"]), {
			topic: "x",
			tone: "",
			language: "es",
			seconds: 10,
			quality: { review: true },
		});
		expect(fallback.title).toBe("La luz del Sol");
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

	const voiced = (sb: ReturnType<typeof assembleStoryboard>) =>
		Object.fromEntries(
			scriptFromStoryboard(sb).scenes.map((scene) => [
				scene.id as string,
				{
					src: `${scene.id}.wav`,
					duration: 4,
					words: scene.narration
						.split(" ")
						.map((text, i) => ({ text, start: i * 0.2, end: i * 0.2 + 0.2 })),
				},
			]),
		);

	it("con voz, cada escena dura la voz más un respiro, y el guion se recupera con ids estables", () => {
		const draft = assembleStoryboard({ script, language: "es", format: "9:16", style });
		const sb = assembleStoryboard({
			script: scriptFromStoryboard(draft),
			language: "es",
			format: "9:16",
			style,
			voices: voiced(draft),
			previous: draft,
		});
		expect(storyboardDuration(sb)).toBeCloseTo(13.5);
		expect(findClip(sb, "voice-scene-2")?.clip.start).toBeCloseTo(4.5);
		expect(isFullyVoiced(sb)).toBe(true);
		const back = scriptFromStoryboard(sb);
		expect(back.scenes.map((s) => s.id)).toEqual(["scene-1", "scene-2", "scene-3"]);
		expect(back.scenes.map(({ narration, content }) => ({ narration, content }))).toEqual(
			script.scenes,
		);
	});

	it("al editar, conserva la voz de las escenas cuya narración no cambió, aunque se reordenen", () => {
		const draft = assembleStoryboard({ script, language: "es", format: "9:16", style });
		const sb = assembleStoryboard({
			script: scriptFromStoryboard(draft),
			language: "es",
			format: "9:16",
			style,
			voices: voiced(draft),
			previous: draft,
		});
		const edited = scriptFromStoryboard(sb);
		const [a, b, c] = edited.scenes;
		if (!a || !b || !c) throw new Error("faltan escenas");
		const next = assembleStoryboard({
			script: { ...edited, scenes: [c, { ...b, narration: "Texto nuevo para la escena." }, a] },
			language: "es",
			format: "9:16",
			style,
			previous: sb,
		});
		expect([...voicedSceneIds(next)].sort()).toEqual(["scene-1", "scene-3"]);
		expect(isFullyVoiced(next)).toBe(false);
		expect(findClip(next, "voice-scene-3")?.clip.start).toBe(0); // la voz sigue a su escena
	});

	it("aplica los ajustes de escena y los recupera", () => {
		const withSettings = {
			...script,
			scenes: script.scenes.map((s, i) =>
				i === 1
					? {
							...s,
							settings: {
								accent: "#FF0000",
								enter: "pop" as const,
								exit: "none" as const,
								extraTime: 1.5,
							},
						}
					: s,
			),
		};
		const sb = assembleStoryboard({ script: withSettings, language: "es", format: "9:16", style });
		const clip = findClip(sb, "scene-2")?.clip;
		expect(clip?.type === "scene" && clip.theme?.accent).toBe("#FF0000");
		expect(clip?.type === "scene" && clip.enter?.type).toBe("pop");
		expect(clip?.type === "scene" && clip.exit).toBeUndefined();
		expect(clip?.duration).toBeCloseTo(estimateSeconds(script.scenes[1]?.narration ?? "") + 1.5);
		expect(scriptFromStoryboard(sb).scenes[1]?.settings).toEqual({
			accent: "#FF0000",
			enter: "pop",
			exit: "none",
			extraTime: 1.5,
		});
		expect(scriptFromStoryboard(sb).scenes[0]?.settings).toBeUndefined();
	});

	it("el estilo visual se cambia en los ajustes del video sin tocar el guion", () => {
		const sb = assembleStoryboard({
			script,
			language: "es",
			format: "9:16",
			style,
			ctaText: "Hola",
		});
		expect(videoSettingsFromStoryboard(sb).visualStyle).toEqual({ id: "libre", options: {} });
		const holo = applyVideoSettings(sb, {
			...videoSettingsFromStoryboard(sb),
			visualStyle: { id: "hologram", options: { model: "satellite" } },
		});
		expect(holo.style.visualStyle).toEqual({ id: "hologram", options: { model: "satellite" } });
		expect(scriptFromStoryboard(holo)).toEqual(scriptFromStoryboard(sb));
		// Sin estilo en los ajustes, se conserva el que tenía.
		const same = applyVideoSettings(holo, {
			captions: holo.style.captions,
			ctaText: "Hola",
			music: null,
		});
		expect(same.style.visualStyle?.id).toBe("hologram");
	});

	it("los ajustes del video añaden música que cubre todo el video y se conserva al editar", () => {
		const sb = assembleStoryboard({
			script,
			language: "es",
			format: "9:16",
			style,
			ctaText: "Síguenos",
		});
		const music = { src: "assets/music/a.mp3", label: "a.mp3", volume: 0.2, fadeIn: 1, fadeOut: 2 };
		const withMusic = applyVideoSettings(sb, {
			captions: { enabled: false, maxWordsPerPage: 3 },
			ctaText: "Más en el canal",
			music,
		});
		expect(videoSettingsFromStoryboard(withMusic)).toEqual({
			captions: { enabled: false, maxWordsPerPage: 3 },
			visualStyle: { id: "libre", options: {} },
			ctaText: "Más en el canal",
			music,
		});
		const longer = assembleStoryboard({
			script: {
				...script,
				scenes: [
					...script.scenes,
					...script.scenes.map(({ narration, content }) => ({ narration, content })),
				],
			},
			language: "es",
			format: "9:16",
			style: withMusic.style,
			previous: withMusic,
		});
		const clip = findClip(longer, "music")?.clip;
		expect(clip?.duration).toBeCloseTo(storyboardDuration(longer));
		expect(clip?.type === "audio" && clip.loop).toBe(true);
		expect(videoSettingsFromStoryboard(longer).ctaText).toBe("Más en el canal");
		expect(
			videoSettingsFromStoryboard(
				applyVideoSettings(longer, { ...videoSettingsFromStoryboard(longer), music: null }),
			).music,
		).toBeNull();
	});
});

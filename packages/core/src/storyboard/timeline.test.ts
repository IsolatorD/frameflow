import { describe, expect, it } from "vitest";
import demoV1 from "../../../renderer-remotion/fixtures/demo.json";
import demoV2 from "../../../renderer-remotion/fixtures/demo-v2.json";
import { type Storyboard, type StoryboardInput, storyboardSchema } from "./schema";
import {
	buildFromScenes,
	captionWords,
	clipEnd,
	findClip,
	parseStoryboard,
	splitClip,
	storyboardDuration,
} from "./timeline";

const style = {
	theme: { background: "#000000", text: "#FFFFFF", accent: "#FAC775", muted: "#888888" },
	fontFamily: "Montserrat",
	captions: { enabled: true, maxWordsPerPage: 4 },
};

const withVoice = (): Storyboard =>
	buildFromScenes({
		title: "Prueba",
		language: "es",
		format: "9:16",
		fps: 30,
		style,
		scenes: [
			{ content: { type: "kinetic-text", lines: [{ text: "Hola" }] }, duration: 2 },
			{
				content: { type: "stat", value: 8, label: "minutos" },
				duration: 2,
				voice: {
					src: "voice/b.wav",
					duration: 3, // más larga que la escena: la escena se alarga
					words: [
						{ text: "Tarda", start: 0.1, end: 0.5 },
						{ text: "ocho", start: 0.6, end: 1.0 },
						{ text: "minutos", start: 1.8, end: 2.4 },
					],
				},
			},
		],
	});

describe("parseStoryboard", () => {
	it("migra un storyboard v1 a pistas conservando duraciones y estilo", () => {
		const sb = parseStoryboard(demoV1);
		expect(sb.version).toBe(2);
		expect(sb.style.theme.accent).toBe("#FAC775");
		const scenes = sb.tracks[0];
		expect(scenes?.kind).toBe("visual");
		expect(scenes?.clips.map((c) => [c.start, c.duration])).toEqual([
			[0, 3],
			[3, 3],
			[6, 3.5],
		]);
		expect(storyboardDuration(sb)).toBe(9.5);
		expect(sb.tracks).toHaveLength(1); // el demo no tiene voces
	});

	it("lee el demo v2 de pistas", () => {
		const sb = parseStoryboard(demoV2);
		expect(sb.tracks.map((t) => t.name)).toEqual(["Escenas", "Textos", "Llamada a la acción"]);
		expect(storyboardDuration(sb)).toBe(9.5);
	});

	it("rechaza lo que no es un storyboard", () => {
		expect(() => parseStoryboard({ foo: 1 })).toThrow("No es un storyboard");
	});
});

describe("buildFromScenes", () => {
	it("une cada voz a su escena y alarga la escena si la voz es más larga", () => {
		const sb = withVoice();
		const voice = findClip(sb, "voice-2")?.clip;
		expect(voice?.type === "audio" && voice.linkedTo).toBe("scene-2");
		expect(findClip(sb, "scene-2")?.clip.duration).toBe(3);
		expect(storyboardDuration(sb)).toBe(5);
	});
});

describe("validación de la línea de tiempo", () => {
	const base = (): StoryboardInput => ({
		version: 2,
		title: "x",
		format: "9:16",
		fps: 30,
		style,
		tracks: [
			{
				kind: "visual",
				id: "t1",
				clips: [
					{ type: "text", id: "a", start: 0, duration: 2, text: "A" },
					{ type: "text", id: "b", start: 2, duration: 1, text: "B" },
				],
			},
		],
	});

	it("acepta clips pegados y aplica valores por defecto", () => {
		const sb = storyboardSchema.parse(base());
		const clip = sb.tracks[0]?.clips[0];
		expect(clip?.type === "text" && clip.style.color).toBe("text");
	});

	it("rechaza clips solapados en la misma pista e ids repetidos", () => {
		const overlap = base();
		const clips = overlap.tracks[0]?.clips;
		if (clips?.[1]) clips[1].start = 1.5;
		expect(() => storyboardSchema.parse(overlap)).toThrow("se solapan");

		const dup = base();
		const dupClips = dup.tracks[0]?.clips;
		if (dupClips?.[1]) dupClips[1].id = "a";
		expect(() => storyboardSchema.parse(dup)).toThrow("Id repetido");
	});

	it("rechaza un enlace a un clip que no existe", () => {
		const sb = base();
		sb.tracks.push({
			kind: "audio",
			id: "t2",
			clips: [
				{
					type: "audio",
					id: "v",
					start: 0,
					duration: 1,
					src: "a.wav",
					role: "voice",
					linkedTo: "nada",
				},
			],
		});
		expect(() => storyboardSchema.parse(sb)).toThrow("que no existe");
	});
});

describe("captionWords", () => {
	it("lleva las palabras al tiempo de la línea de tiempo", () => {
		const words = captionWords(withVoice());
		expect(words.map((w) => w.text)).toEqual(["Tarda", "ocho", "minutos"]);
		expect(words[0]?.start).toBeCloseTo(2.1); // la voz empieza en el segundo 2
	});

	it("ignora pistas silenciadas y la parte recortada del audio", () => {
		const sb = withVoice();
		const cut = splitClip(sb, "voice-2", 3.5, "voice-2b"); // corta tras "ocho"
		const trimmed = {
			...cut,
			tracks: cut.tracks.map((t) =>
				t.kind === "audio" ? { ...t, clips: t.clips.filter((c) => c.id !== "voice-2b") } : t,
			),
		};
		expect(captionWords(trimmed).map((w) => w.text)).toEqual(["Tarda", "ocho"]);

		const muted = {
			...sb,
			tracks: sb.tracks.map((t) => (t.kind === "audio" ? { ...t, muted: true } : t)),
		};
		expect(captionWords(muted)).toEqual([]);
	});
});

describe("splitClip", () => {
	it("corta en dos sin mover el contenido y avanza el recorte del audio", () => {
		const sb = splitClip(withVoice(), "voice-2", 3, "voice-2b");
		const left = findClip(sb, "voice-2")?.clip;
		const right = findClip(sb, "voice-2b")?.clip;
		expect(left && clipEnd(left)).toBe(3);
		expect(right?.start).toBe(3);
		expect(right?.type === "audio" && right.trimStart).toBe(1);
		expect(right && clipEnd(right)).toBe(5);
		expect(() => storyboardSchema.parse(sb)).not.toThrow();
		expect(captionWords(sb)).toHaveLength(3); // suena igual que antes del corte
	});

	it("no corta fuera del clip ni repite ids", () => {
		expect(() => splitClip(withVoice(), "scene-1", 2, "x")).toThrow("dentro del clip");
		expect(() => splitClip(withVoice(), "scene-1", 1, "scene-2")).toThrow("ya existe");
	});
});

import { describe, expect, it } from "vitest";
import { captionWords, findClip, storyboardDuration } from "../storyboard/timeline";
import { applyTimelineEdit, sceneMinDuration, updateCaptions, voiceClipOf } from "./edit";
import { assembleStoryboard, scriptFromStoryboard, starterScript } from "./script";

const style = {
	theme: { background: "#000000", text: "#FFFFFF", accent: "#FAC775", muted: "#888888" },
	fontFamily: "Montserrat",
	captions: { enabled: true, maxWordsPerPage: 4 },
};

/** Video de 3 escenas con voz de 3 s cada una y llamada a la acción. */
const voicedVideo = () => {
	const draft = assembleStoryboard({
		script: starterScript("el cielo"),
		language: "es",
		format: "9:16",
		style,
		ctaText: "Síguenos",
	});
	const script = scriptFromStoryboard(draft);
	const voices = Object.fromEntries(
		script.scenes.map((s) => [
			s.id as string,
			{
				src: `${s.id}.wav`,
				duration: 3,
				words: s.narration.split(" ").map((text, i, all) => ({
					text,
					start: (i * 3) / all.length,
					end: ((i + 1) * 3) / all.length,
				})),
			},
		]),
	);
	return assembleStoryboard({
		script,
		language: "es",
		format: "9:16",
		style,
		voices,
		previous: draft,
	});
};

describe("ediciones de la línea de tiempo", () => {
	it("alargar una escena añade pausa tras la voz; acortarla nunca corta la voz", () => {
		const sb = voicedVideo();
		expect(sceneMinDuration(sb, "scene-2")).toBeCloseTo(3.5);
		const longer = applyTimelineEdit(sb, {
			type: "sceneDuration",
			sceneId: "scene-2",
			duration: 5,
		});
		expect(findClip(longer, "scene-2")?.clip.duration).toBeCloseTo(5);
		expect(findClip(longer, "scene-3")?.clip.start).toBeCloseTo(8.5); // la siguiente se desplaza
		const shorter = applyTimelineEdit(longer, {
			type: "sceneDuration",
			sceneId: "scene-2",
			duration: 1,
		});
		expect(findClip(shorter, "scene-2")?.clip.duration).toBeCloseTo(3.5);
	});

	it("mover una escena la reordena y su voz la acompaña", () => {
		const moved = applyTimelineEdit(voicedVideo(), {
			type: "moveScene",
			sceneId: "scene-3",
			toIndex: 0,
		});
		expect(scriptFromStoryboard(moved).scenes.map((s) => s.id)).toEqual([
			"scene-3",
			"scene-1",
			"scene-2",
		]);
		expect(findClip(moved, "voice-scene-3")?.clip.start).toBe(0);
	});

	it("la llamada a la acción se mueve dentro del video y conserva su hueco final al editar", () => {
		const sb = voicedVideo();
		const total = storyboardDuration(sb);
		const cta = applyTimelineEdit(sb, { type: "ctaTiming", start: total - 5, duration: 3 });
		expect(findClip(cta, "cta")?.clip).toMatchObject({ start: total - 5, duration: 3 });
		// Al alargar una escena, la llamada sigue a 2 s del final.
		const longer = applyTimelineEdit(cta, {
			type: "sceneDuration",
			sceneId: "scene-1",
			duration: 5,
		});
		const clip = findClip(longer, "cta")?.clip;
		expect((clip?.start ?? 0) + (clip?.duration ?? 0)).toBeCloseTo(storyboardDuration(longer) - 2);
		// No se puede sacar del video.
		const clamped = applyTimelineEdit(sb, { type: "ctaTiming", start: total + 10, duration: 50 });
		const c = findClip(clamped, "cta")?.clip;
		expect((c?.start ?? 0) + (c?.duration ?? 0)).toBeLessThanOrEqual(total + 1e-9);
	});
});

describe("editor de subtítulos", () => {
	it("cambia el texto mostrado y los tiempos; sobrevive a editar otra escena", () => {
		const sb = voicedVideo();
		const words = voiceClipOf(sb, "scene-2")?.words ?? [];
		const edited = updateCaptions(
			sb,
			"scene-2",
			words.map((w, i) => ({
				start: w.start,
				end: w.end,
				display: i === 0 ? "ESCRIBE" : undefined,
			})),
		);
		expect(captionWords(edited).some((w) => w.text === "ESCRIBE")).toBe(true);
		// Editar la escena 1 no pierde la corrección de la escena 2 (su narración no cambió).
		const script = scriptFromStoryboard(edited);
		const next = assembleStoryboard({
			script: {
				...script,
				scenes: script.scenes.map((s, i) =>
					i === 0 ? { ...s, narration: "Otra frase de inicio." } : s,
				),
			},
			language: "es",
			format: "9:16",
			style,
			previous: edited,
		});
		expect(voiceClipOf(next, "scene-2")?.words?.[0]?.display).toBe("ESCRIBE");
	});

	it("rechaza tiempos desordenados, invertidos o fuera de la voz", () => {
		const sb = voicedVideo();
		const words = voiceClipOf(sb, "scene-1")?.words ?? [];
		const base = words.map((w) => ({ start: w.start, end: w.end }));
		expect(() =>
			updateCaptions(
				sb,
				"scene-1",
				base.map((w, i) => (i === 2 ? { start: 0, end: 0.1 } : w)),
			),
		).toThrow("antes que la palabra anterior");
		expect(() =>
			updateCaptions(
				sb,
				"scene-1",
				base.map((w, i) => (i === 0 ? { start: 0.5, end: 0.2 } : w)),
			),
		).toThrow("posterior al inicio");
		expect(() =>
			updateCaptions(
				sb,
				"scene-1",
				base.map((w, i, all) => (i === all.length - 1 ? { start: w.start, end: 9 } : w)),
			),
		).toThrow("acabe la voz");
		expect(() => updateCaptions(sb, "scene-1", base.slice(1))).toThrow("no coincide");
	});
});

import { describe, expect, it } from "vitest";
import { storyboardSchema } from "../storyboard/schema";
import { captionWords, findClip, storyboardDuration } from "../storyboard/timeline";
import {
	addOverlay,
	deleteOverlay,
	duplicateOverlay,
	isOverlayClip,
	moveOverlay,
	overlayLimits,
	trimOverlay,
	updateOverlay,
} from "./overlays";
import { assembleStoryboard, scriptFromStoryboard, starterScript } from "./script";

const style = {
	theme: { background: "#000000", text: "#FFFFFF", accent: "#FAC775", muted: "#888888" },
	fontFamily: "Montserrat",
	captions: { enabled: true, maxWordsPerPage: 4 },
};
const base = () =>
	assembleStoryboard({ script: starterScript("el cielo"), language: "es", format: "9:16", style });

describe("capas libres", () => {
	it("añade un texto donde está el cabezal y crea otra capa si se solapa", () => {
		const sb = base();
		const a = addOverlay(sb, { type: "text", text: "¡Atención!" }, 1);
		expect(a.clipId).toBe("text-1");
		expect(findClip(a.storyboard, "text-1")?.clip).toMatchObject({ start: 1, duration: 3 });
		const b = addOverlay(a.storyboard, { type: "text", text: "Otro" }, 2);
		const tracks = b.storyboard.tracks.filter((t) => t.id.startsWith("track-overlay-"));
		expect(tracks.map((t) => t.name)).toEqual(["Capa 1", "Capa 2"]);
		const c = addOverlay(b.storyboard, { type: "image", src: "assets/images/a.png" }, 5);
		expect(findClip(c.storyboard, c.clipId)?.track.name).toBe("Capa 1"); // cabe en la primera
		expect(() => storyboardSchema.parse(c.storyboard)).not.toThrow();
	});

	it("un video se añade silenciado y con su duración (máx. 10 s)", () => {
		const { storyboard, clipId } = addOverlay(
			base(),
			{ type: "video", src: "v.mp4", sourceDuration: 4 },
			0,
		);
		expect(findClip(storyboard, clipId)?.clip).toMatchObject({ duration: 4, volume: 0 });
	});

	it("edita solo lo que aplica a su tipo y no toca las pistas del guion", () => {
		const { storyboard, clipId } = addOverlay(base(), { type: "text", text: "Hola" }, 0);
		const edited = updateOverlay(storyboard, clipId, {
			text: "Hola mundo",
			style: {
				fontSize: 100,
				fontWeight: 900,
				color: "accent",
				background: "background",
				align: "left",
			},
			transform: { x: 0.2, y: 0.8, scale: 1.5, rotation: 0, opacity: 0.5 },
			fit: "cover", // no aplica a textos: se ignora
		});
		const clip = findClip(edited, clipId)?.clip;
		expect(clip?.type === "text" && clip.text).toBe("Hola mundo");
		expect(clip?.type === "text" && clip.style.color).toBe("accent");
		expect(clip?.type === "text" && clip.transform?.y).toBe(0.8);
		expect(() => updateOverlay(edited, "scene-1", { text: "x" })).toThrow("capas que añadiste");
	});

	it("mover y recortar respeta a las vecinas de pista y el final del video", () => {
		let sb = addOverlay(base(), { type: "text", text: "A" }, 0).storyboard; // 0–3
		sb = addOverlay(sb, { type: "text", text: "B" }, 5).storyboard; // 5–8, misma capa
		expect(overlayLimits(sb, "text-2")).toMatchObject({ minStart: 3 });
		sb = moveOverlay(sb, "text-2", 1); // no puede pisar a A
		expect(findClip(sb, "text-2")?.clip.start).toBe(3);
		sb = trimOverlay(sb, "text-1", 10); // no puede pisar a B
		expect(findClip(sb, "text-1")?.clip.duration).toBe(3);
		sb = moveOverlay(sb, "text-2", 999);
		const b = findClip(sb, "text-2")?.clip;
		expect((b?.start ?? 0) + (b?.duration ?? 0)).toBeCloseTo(storyboardDuration(base()));
	});

	it("duplica a continuación y borra (una capa vacía desaparece)", () => {
		const added = addOverlay(base(), { type: "text", text: "A" }, 0);
		const dup = duplicateOverlay(added.storyboard, added.clipId);
		expect(findClip(dup.storyboard, dup.clipId)?.clip.start).toBe(3);
		let sb = deleteOverlay(dup.storyboard, added.clipId);
		sb = deleteOverlay(sb, dup.clipId);
		expect(sb.tracks.some((t) => t.id.startsWith("track-overlay-"))).toBe(false);
		expect(isOverlayClip(dup.storyboard, dup.clipId)).toBe(true);
		expect(isOverlayClip(dup.storyboard, "scene-1")).toBe(false);
	});

	it("las capas sobreviven a editar el guion y se recortan si el video se acorta", () => {
		const added = addOverlay(base(), { type: "text", text: "Final" }, 7);
		const sb = trimOverlay(added.storyboard, added.clipId, 5);
		const script = scriptFromStoryboard(sb);
		const shorter = assembleStoryboard({
			script: { ...script, scenes: script.scenes.slice(0, 2) },
			language: "es",
			format: "9:16",
			style,
			previous: sb,
		});
		const total = storyboardDuration({
			...shorter,
			tracks: shorter.tracks.filter((t) => !t.id.startsWith("track-overlay-")),
		});
		const clip = findClip(shorter, added.clipId)?.clip;
		expect(clip).toBeDefined();
		expect((clip?.start ?? 0) + (clip?.duration ?? 0)).toBeLessThanOrEqual(total + 1e-9);
		expect(storyboardDuration(shorter)).toBeCloseTo(total);
		expect(captionWords(shorter)).toEqual([]);
	});
});

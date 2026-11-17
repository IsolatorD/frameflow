import { describe, expect, it } from "vitest";
import { addOverlay, trimOverlay, updateOverlay } from "../script/overlays";
import { assembleStoryboard, starterScript } from "../script/script";
import {
	EASINGS,
	keyframeAt,
	removeKeyframe,
	setKeyframeEasing,
	transformAt,
	upsertKeyframe,
} from "./keyframes";
import { findClip } from "./timeline";

const T = (x: number, scale = 1, opacity = 1) => ({ x, y: 0.5, scale, rotation: 0, opacity });

describe("fotogramas clave", () => {
	it("sin fotogramas usa la transformación fija (con valores por defecto)", () => {
		expect(transformAt({}, 3)).toEqual({ x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1 });
		expect(transformAt({ transform: T(0.2) }, 3).x).toBe(0.2);
	});

	it("interpola entre fotogramas y mantiene antes del primero y después del último", () => {
		const keyframes = [
			{ at: 1, transform: T(0, 1), easing: "linear" as const },
			{ at: 3, transform: T(1, 2), easing: "linear" as const },
		];
		expect(transformAt({ keyframes }, 0).x).toBe(0);
		expect(transformAt({ keyframes }, 2)).toMatchObject({ x: 0.5, scale: 1.5 });
		expect(transformAt({ keyframes }, 9).x).toBe(1);
	});

	it("con curva suave va despacio al principio y al final", () => {
		const keyframes = [
			{ at: 0, transform: T(0), easing: "ease" as const },
			{ at: 1, transform: T(1), easing: "ease" as const },
		];
		expect(transformAt({ keyframes }, 0.1).x).toBeLessThan(0.1);
		expect(transformAt({ keyframes }, 0.5).x).toBeCloseTo(0.5);
		expect(transformAt({ keyframes }, 0.9).x).toBeGreaterThan(0.9);
	});

	it("cada curva empieza en 0, acaba en 1 y tiene su forma", () => {
		for (const curve of Object.values(EASINGS)) {
			expect(curve(0)).toBe(0);
			expect(curve(1)).toBe(1);
		}
		expect(EASINGS["ease-in"](0.25)).toBeLessThan(0.25); // empieza lenta
		expect(EASINGS["ease-out"](0.25)).toBeGreaterThan(0.25); // empieza rápida
		expect(EASINGS.linear(0.25)).toBe(0.25);
	});

	it("la curva de un fotograma se puede cambiar y manda en el tramo que llega a él", () => {
		const keyframes = setKeyframeEasing(
			upsertKeyframe(upsertKeyframe([], 0, T(0)), 1, T(1)),
			1,
			"linear",
		);
		expect(keyframes[1]?.easing).toBe("linear");
		expect(transformAt({ keyframes }, 0.25).x).toBeCloseTo(0.25);
		const eased = setKeyframeEasing(keyframes, 1, "ease-out");
		expect(transformAt({ keyframes: eased }, 0.25).x).toBeGreaterThan(0.5);
	});

	it("poner un fotograma en el mismo instante lo reemplaza; quitarlo lo borra", () => {
		let k = upsertKeyframe([], 1, T(0));
		k = upsertKeyframe(k, 0, T(0.3));
		k = upsertKeyframe(k, 1.02, T(0.9)); // mismo instante (tolerancia)
		expect(k.map((f) => f.at)).toEqual([0, 1]);
		expect(keyframeAt(k, 1)?.transform.x).toBe(0.9);
		expect(removeKeyframe(k, 1).map((f) => f.at)).toEqual([0]);
	});

	it("una capa guarda su animación, y recortarla descarta los fotogramas que quedan fuera", () => {
		const sb = assembleStoryboard({
			script: starterScript("x"),
			language: "es",
			format: "9:16",
			style: {
				theme: { background: "#000000", text: "#FFFFFF", accent: "#FAC775", muted: "#888888" },
				fontFamily: "Montserrat",
				captions: { enabled: true, maxWordsPerPage: 4 },
			},
		});
		const { storyboard, clipId } = addOverlay(sb, { type: "text", text: "Hola" }, 0);
		const keyframes = upsertKeyframe(upsertKeyframe([], 0, T(0.1)), 2.5, T(0.9));
		const animated = updateOverlay(storyboard, clipId, { keyframes });
		const clip = findClip(animated, clipId)?.clip;
		expect(clip?.type === "text" && clip.keyframes?.length).toBe(2);
		const trimmed = trimOverlay(animated, clipId, 2);
		const after = findClip(trimmed, clipId)?.clip;
		expect(after?.type === "text" && after.keyframes?.map((f) => f.at)).toEqual([0]);
		const cleared = updateOverlay(animated, clipId, { keyframes: [] });
		const none = findClip(cleared, clipId)?.clip;
		expect(none?.type === "text" && none.keyframes).toBeUndefined();
	});
});

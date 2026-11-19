import { describe, expect, it } from "vitest";
import { SCENE_KIND_LABELS, sceneContentSchema, sceneSummary } from "./scenes";

describe("tipos de escena", () => {
	it("valida pasos, línea de tiempo, comparación y gráfico con sus límites", () => {
		expect(sceneContentSchema.safeParse({ type: "steps", items: ["Uno", "Dos"] }).success).toBe(
			true,
		);
		expect(sceneContentSchema.safeParse({ type: "steps", items: ["Solo uno"] }).success).toBe(
			false,
		);
		expect(
			sceneContentSchema.safeParse({
				type: "compare",
				items: [{ label: "A" }, { label: "B" }, { label: "C" }],
			}).success,
		).toBe(false);
		expect(
			sceneContentSchema.safeParse({
				type: "chart",
				bars: [
					{ label: "A", value: 1 },
					{ label: "B", value: -2 },
				],
			}).success,
		).toBe(false);
		expect(
			sceneContentSchema.safeParse({
				type: "timeline",
				events: [
					{ when: "1609", label: "Telescopio" },
					{ when: "1969", label: "Luna" },
				],
			}).success,
		).toBe(true);
	});

	it("resume cada tipo en una línea", () => {
		expect(sceneSummary({ type: "steps", items: ["Mira", "Piensa"] })).toBe("1. Mira · 2. Piensa");
		expect(
			sceneSummary({
				type: "compare",
				items: [{ label: "Sol", detail: "8 min" }, { label: "Luna" }],
			}),
		).toBe("Sol (8 min) vs Luna");
		expect(
			sceneSummary({
				type: "chart",
				suffix: " s",
				bars: [
					{ label: "Luna", value: 1.3 },
					{ label: "Sol", value: 499 },
				],
			}),
		).toBe("Luna 1.3 s · Sol 499 s");
		expect(SCENE_KIND_LABELS.timeline).toBe("Línea de tiempo");
	});
});

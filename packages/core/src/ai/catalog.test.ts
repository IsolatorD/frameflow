import { describe, expect, it } from "vitest";
import {
	aiSettingsSchema,
	defaultAiSettings,
	keyHint,
	keyWarning,
	modelLabel,
	QWEN3_8B,
	QWEN3_14B,
	recommendLocalModel,
} from "./catalog";

describe("catálogo de IA", () => {
	it("los ajustes por defecto son válidos y usan Ollama", () => {
		const settings = aiSettingsSchema.parse(defaultAiSettings());
		expect(settings.provider).toBe("ollama");
		expect(settings.models.anthropic).toBe("claude-opus-5-5");
	});

	it("recomienda modelo local según la RAM y avisa de la GPU fuera de Apple Silicon", () => {
		expect(recommendLocalModel({ platform: "darwin", arch: "arm64", ramGb: 16 })).toEqual({
			kind: "model",
			model: QWEN3_14B,
			reason: expect.not.stringContaining("tarjeta gráfica"),
		});
		const windows = recommendLocalModel({ platform: "win32", arch: "x64", ramGb: 12 });
		expect(windows).toMatchObject({ kind: "model", model: QWEN3_8B });
		expect(windows.reason).toContain("tarjeta gráfica");
		expect(recommendLocalModel({ platform: "linux", arch: "x64", ramGb: 4 }).kind).toBe("cloud");
	});

	it("nombres, avisos de formato y pista de la clave", () => {
		expect(modelLabel("ollama", QWEN3_14B)).toBe("Qwen3 14B");
		expect(modelLabel("openai", "mi-modelo")).toBe("mi-modelo");
		expect(keyWarning("anthropic", "sk-ant-api03-xyz")).toBeNull();
		expect(keyWarning("gemini", "sk-123")).toContain("AIza");
		expect(keyHint("  sk-ant-abcd1234 ")).toBe("…1234");
	});
});

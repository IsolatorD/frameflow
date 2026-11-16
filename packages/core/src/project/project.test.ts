import { describe, expect, it } from "vitest";
import { findPreset } from "../presets/presets";
import {
	brandKitFromPreset,
	brandKitSchema,
	brandThemeWarnings,
	contrastRatio,
	createProjectInputSchema,
	normalizeHashtags,
	slugify,
} from "./project";

describe("slugify", () => {
	it("quita tildes y símbolos", () => {
		expect(slugify("Astro Info: ¡Ñandú y más!")).toBe("astro-info-nandu-y-mas");
	});
});

describe("brandKitFromPreset", () => {
	it("copia tema y crea una voz por idioma", () => {
		const preset = findPreset("ciencia");
		if (!preset) throw new Error("falta preset");
		const kit = brandKitFromPreset(preset, ["es", "en"]);
		expect(kit.voices.es?.voiceId).toBe("em_alex");
		expect(kit.voices.en?.voiceId).toBe("am_michael");
		kit.theme.accent = "#000";
		expect(preset.theme.accent).not.toBe("#000"); // es copia, no referencia
	});
});

describe("createProjectInputSchema", () => {
	it("exige nombre e idiomas", () => {
		const result = createProjectInputSchema.safeParse({
			name: "A",
			presetId: "ciencia",
			languages: [],
		});
		expect(result.success).toBe(false);
	});
	it("aplica valores por defecto", () => {
		const parsed = createProjectInputSchema.parse({
			name: "  Astroinfo ",
			presetId: "ciencia",
			languages: ["es"],
		});
		expect(parsed).toMatchObject({ name: "Astroinfo", description: "", defaultFormat: "9:16" });
	});
});

describe("normalizeHashtags", () => {
	it("añade #, separa por comas o espacios y quita repetidos", () => {
		expect(normalizeHashtags("astronomía, #Espacio  ciencia #espacio ##nasa!")).toEqual([
			"#astronomía",
			"#Espacio",
			"#ciencia",
			"#nasa",
		]);
		expect(normalizeHashtags("  ")).toEqual([]);
	});
});

describe("contraste del tema", () => {
	it("calcula la relación WCAG", () => {
		expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 0);
		expect(contrastRatio("#777777", "#777777")).toBe(1);
	});

	it("avisa cuando el texto o el acento no se leen sobre el fondo", () => {
		const base = { background: "#04342C", text: "#FFFFFF", accent: "#5DCAA5", muted: "#9FE1CB" };
		expect(brandThemeWarnings(base)).toEqual([]);
		expect(brandThemeWarnings({ ...base, accent: "#0A4A3E" })).toHaveLength(1);
		expect(brandThemeWarnings({ ...base, text: "#04342D", accent: "#04342D" })).toHaveLength(2);
	});
});

describe("brandKitSchema", () => {
	it("acepta el BrandKit de cualquier preset y rechaza colores no hexadecimales", () => {
		const preset = findPreset("historia");
		if (!preset) throw new Error("falta preset");
		const kit = brandKitFromPreset(preset, ["es"]);
		expect(brandKitSchema.safeParse(kit).success).toBe(true);
		const bad = brandKitSchema.safeParse({ ...kit, theme: { ...kit.theme, accent: "rojo" } });
		expect(bad.success).toBe(false);
	});
});

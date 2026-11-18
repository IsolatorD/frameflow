import { z } from "zod";
import { resolveVisualStyle, visualStyleSchema } from "../look/looks";
import type { NichePreset } from "../presets/presets";
import { formatSchema, themeSchema, type VideoStyle } from "../storyboard/schema";

export const SUPPORTED_LANGUAGES = ["es", "en"] as const;
export const languageSchema = z.enum(SUPPORTED_LANGUAGES);
export type Language = z.infer<typeof languageSchema>;

export const createProjectInputSchema = z.object({
	name: z.string().trim().min(2, "El nombre necesita al menos 2 caracteres").max(60),
	description: z.string().trim().max(280).default(""),
	presetId: z.string().min(1),
	languages: z.array(languageSchema).min(1, "Elige al menos un idioma"),
	defaultFormat: formatSchema.default("9:16"),
});
export type CreateProjectInput = z.input<typeof createProjectInputSchema>;

export const SPEED_RANGE = { min: 0.7, max: 1.4, step: 0.05 } as const;
export const WORDS_PER_PAGE_RANGE = { min: 1, max: 8 } as const;

export const voiceSettingSchema = z.object({
	engine: z.enum(["kokoro", "recorded"]),
	voiceId: z.string().min(1, "Elige una voz"),
	speed: z
		.number()
		.min(SPEED_RANGE.min, `La velocidad mínima es ${SPEED_RANGE.min}×`)
		.max(SPEED_RANGE.max, `La velocidad máxima es ${SPEED_RANGE.max}×`),
});

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const hexColor = z
	.string()
	.regex(HEX_COLOR, "Usa un color hexadecimal de 6 dígitos, p. ej. #1A2B3C");

/** Igual que el tema del storyboard, pero exigiendo colores #RRGGBB (los edita el usuario). */
export const brandThemeSchema = themeSchema.extend({
	background: hexColor,
	text: hexColor,
	accent: hexColor,
	muted: hexColor,
});

export const brandKitSchema = z.object({
	tone: z.string().trim().max(400, "El tono admite hasta 400 caracteres"),
	theme: brandThemeSchema,
	fontFamily: z.string().min(1),
	voices: z.record(z.string(), voiceSettingSchema),
	captions: z.object({
		enabled: z.boolean(),
		maxWordsPerPage: z.number().int().min(WORDS_PER_PAGE_RANGE.min).max(WORDS_PER_PAGE_RANGE.max),
	}),
	defaultHashtags: z.array(z.string().regex(/^#[\p{L}\p{N}_]+$/u)).max(30, "Máximo 30 hashtags"),
	ctaText: z.string().trim().max(120, "La llamada a la acción admite hasta 120 caracteres"),
	/** Estilo visual por defecto de los videos del proyecto (cada video puede cambiarlo). */
	visualStyle: visualStyleSchema.optional(),
});
export type BrandKit = z.infer<typeof brandKitSchema>;

export type Project = {
	id: string;
	name: string;
	slug: string;
	description: string;
	presetId: string;
	languages: Language[];
	defaultFormat: z.infer<typeof formatSchema>;
	createdAt: string; // ISO
	archivedAt: string | null;
};

export type ProjectWithBrand = Project & { brandKit: BrandKit };

/** Lo que muestran los listados: el proyecto y sus colores de marca actuales. */
export type ProjectSummary = Project & { theme: BrandKit["theme"] };

export const slugify = (text: string): string =>
	text
		.normalize("NFD")
		.replace(/\p{M}/gu, "") // quita tildes y diacríticos
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 50);

/** "astronomía, #Espacio  ciencia" → ["#astronomía", "#Espacio", "#ciencia"] (sin repetidos). */
export const normalizeHashtags = (text: string): string[] => {
	const tags = text
		.split(/[\s,]+/)
		.map((t) => t.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, ""))
		.filter(Boolean)
		.map((t) => `#${t}`);
	const seen = new Set<string>();
	return tags.filter((t) => {
		const key = t.toLowerCase();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

/** Relación de contraste WCAG entre dos colores #RRGGBB (1 = igual, 21 = blanco/negro). */
export const contrastRatio = (a: string, b: string): number => {
	const luminance = (hex: string) => {
		const [r, g, bl] = [1, 3, 5].map((i) => {
			const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
			return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		}) as [number, number, number];
		return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
	};
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
	return (hi + 0.05) / (lo + 0.05);
};

/**
 * Avisos de legibilidad del tema (no bloquean el guardado).
 * Umbral 3:1: en video el texto es grande y en negrita (WCAG "texto grande").
 */
export const brandThemeWarnings = (theme: z.infer<typeof themeSchema>): string[] => {
	if (![theme.background, theme.text, theme.accent].every((c) => HEX_COLOR.test(c))) return [];
	const warnings: string[] = [];
	if (contrastRatio(theme.text, theme.background) < 3)
		warnings.push("El texto apenas se distingue del fondo.");
	if (contrastRatio(theme.accent, theme.background) < 3)
		warnings.push("El acento apenas se distingue del fondo: las cifras destacadas se leerán mal.");
	return warnings;
};

/** El BrandKit inicial de un proyecto es una copia del preset para sus idiomas. */
export const brandKitFromPreset = (
	preset: NichePreset,
	languages: readonly Language[],
): BrandKit => ({
	tone: preset.tone,
	theme: { ...preset.theme },
	fontFamily: "Montserrat",
	voices: Object.fromEntries(
		languages.map((lang) => [
			lang,
			{
				engine: "kokoro" as const,
				voiceId: preset.voices[lang] ?? preset.voices.en ?? "af_heart",
				speed: preset.speed,
			},
		]),
	),
	captions: { enabled: true, maxWordsPerPage: 4 },
	defaultHashtags: [],
	ctaText: "",
});

/** Copia de la marca que se guarda dentro de cada video al generarlo. */
export const videoStyleFromBrandKit = (brandKit: BrandKit): VideoStyle => ({
	theme: { ...brandKit.theme },
	// Marcas guardadas antes de los estilos visuales no traen el campo: "Libre".
	visualStyle: resolveVisualStyle(brandKit.visualStyle),
	fontFamily: brandKit.fontFamily,
	captions: { ...brandKit.captions },
});

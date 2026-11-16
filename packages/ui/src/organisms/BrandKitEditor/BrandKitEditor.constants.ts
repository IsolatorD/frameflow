import type { BrandKitDraft } from "./BrandKitEditorInterface";

export const COLOR_FIELDS = [
	{ key: "background", label: "Fondo" },
	{ key: "text", label: "Texto" },
	{ key: "accent", label: "Acento", hint: "Cifras, palabra activa del subtítulo y botones" },
	{ key: "muted", label: "Secundario" },
] as const;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export type ColorErrors = Partial<Record<keyof BrandKitDraft["theme"], string>>;

export const colorErrors = (theme: BrandKitDraft["theme"]): ColorErrors =>
	Object.fromEntries(
		COLOR_FIELDS.filter(({ key }) => !HEX_COLOR.test(theme[key])).map(({ key }) => [
			key,
			"Usa 6 dígitos hexadecimales, p. ej. #1A2B3C",
		]),
	);

export const hashtagsToText = (tags: readonly string[]): string => tags.join(" ");

/** Compara borrador y guardado por valor (el orden de claves es estable: viene del mismo origen). */
export const sameKit = (a: BrandKitDraft, b: BrandKitDraft): boolean =>
	JSON.stringify(a) === JSON.stringify(b);

export const formatSpeed = (speed: number) => `${speed.toFixed(2)}×`;
export const formatWords = (n: number) => (n === 1 ? "1 palabra" : `${n} palabras`);

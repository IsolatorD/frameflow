import { FONTS, voiceLabel, voicesFor } from "@frameflow/core/catalog";
import type { ProjectWithBrand } from "@frameflow/core/project";
import type { SelectOption } from "@frameflow/ui/src/atoms/SelectField/SelectFieldInterface";
import type { BrandKitEditorLanguage } from "@frameflow/ui/src/organisms/BrandKitEditor/BrandKitEditorInterface";

const LANGUAGE_NAMES: Record<string, string> = { es: "Español", en: "Inglés" };

/** Un bloque de voz por idioma del proyecto, con las voces de Kokoro de ese idioma. */
export const editorLanguages = (project: ProjectWithBrand): BrandKitEditorLanguage[] =>
	project.languages.map((code) => {
		const options: SelectOption[] = voicesFor(code).map((v) => ({
			value: v.id,
			label: voiceLabel(v.id),
		}));
		const current = project.brandKit.voices[code]?.voiceId;
		// Si la voz guardada no está en el catálogo (p. ej. una antigua), se conserva como opción.
		if (current && !options.some((o) => o.value === current)) {
			options.unshift({ value: current, label: voiceLabel(current) });
		}
		return { code, label: LANGUAGE_NAMES[code] ?? code, voiceOptions: options };
	});

export const fontOptions = (current: string): SelectOption[] => {
	const options = FONTS.map((f) => ({ value: f.family, label: `${f.family} · ${f.description}` }));
	return options.some((o) => o.value === current)
		? options
		: [{ value: current, label: current }, ...options];
};

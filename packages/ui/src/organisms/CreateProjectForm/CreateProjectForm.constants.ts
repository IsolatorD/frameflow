import type { CreateProjectValues } from "./CreateProjectFormInterface";

export const LANGUAGE_OPTIONS = [
	{ value: "es", label: "Español" },
	{ value: "en", label: "Inglés" },
] as const;

export type CreateProjectErrors = Partial<Record<"name" | "presetId" | "languages", string>>;

/** Validación rápida en la interfaz; la definitiva la hace el proceso principal con zod. */
export function validateCreateProject(values: CreateProjectValues): CreateProjectErrors {
	const errors: CreateProjectErrors = {};
	if (values.name.trim().length < 2) errors.name = "El nombre necesita al menos 2 caracteres";
	if (!values.presetId) errors.presetId = "Elige un nicho de partida";
	if (values.languages.length === 0) errors.languages = "Elige al menos un idioma";
	return errors;
}

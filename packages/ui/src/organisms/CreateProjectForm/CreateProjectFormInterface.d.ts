export interface PresetOption {
	id: string;
	label: string;
	description: string;
	colors: { background: string; accent: string; text: string };
}

export interface CreateProjectValues {
	name: string;
	description: string;
	presetId: string;
	languages: string[];
}

export interface CreateProjectFormProps {
	presets: readonly PresetOption[];
	onSubmit: (values: CreateProjectValues) => void;
	onCancel: () => void;
	submitting?: boolean;
	/** Error devuelto al guardar (p. ej. validación del proceso principal). */
	serverError?: string;
}

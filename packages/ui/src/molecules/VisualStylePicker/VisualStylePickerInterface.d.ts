export interface VisualStyleChoice {
	id: string;
	name: string;
	description: string;
	/** Atribución del estilo original, si lo hay. */
	credit?: string;
	options: readonly {
		id: string;
		label: string;
		choices: readonly { id: string; label: string }[];
		default: string;
	}[];
}

export interface VisualStyleValue {
	id: string;
	options: Record<string, string>;
}

export interface VisualStylePickerProps {
	/** Prefijo de ids (dos selectores en la misma pantalla no deben chocar). */
	idPrefix: string;
	styles: readonly VisualStyleChoice[];
	value: VisualStyleValue;
	onChange: (value: VisualStyleValue) => void;
	disabled?: boolean;
}

export interface ColorFieldProps {
	id: string;
	label: string;
	/** Color #RRGGBB (mientras el usuario escribe puede ser inválido). */
	value: string;
	onChange: (value: string) => void;
	error?: string;
}

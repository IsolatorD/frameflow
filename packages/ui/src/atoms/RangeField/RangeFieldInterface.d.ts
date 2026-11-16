export interface RangeFieldProps {
	id: string;
	label: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	onChange: (value: number) => void;
	/** Cómo mostrar el valor (p. ej. "1.05×"). */
	format?: (value: number) => string;
	disabled?: boolean;
}

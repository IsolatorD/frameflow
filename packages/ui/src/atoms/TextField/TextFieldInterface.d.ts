export interface TextFieldProps {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	error?: string;
	hint?: string;
	multiline?: boolean;
	maxLength?: number;
	autoFocus?: boolean;
	/** "password" oculta el texto y desactiva el autocompletado (claves de API). */
	type?: "text" | "number" | "password";
	disabled?: boolean;
}

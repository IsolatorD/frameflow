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
	type?: "text" | "number";
	disabled?: boolean;
}

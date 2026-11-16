export interface SwitchFieldProps {
	label: string;
	description?: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}

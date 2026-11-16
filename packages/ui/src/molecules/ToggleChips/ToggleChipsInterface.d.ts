export interface ToggleChipOption {
	value: string;
	label: string;
}

export interface ToggleChipsProps {
	label: string;
	options: readonly ToggleChipOption[];
	selected: readonly string[];
	onChange: (selected: string[]) => void;
	error?: string;
}

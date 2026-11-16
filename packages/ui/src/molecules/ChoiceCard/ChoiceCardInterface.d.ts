export interface ChoiceCardProps {
	name: string;
	value: string;
	title: string;
	description: string;
	selected: boolean;
	onSelect: (value: string) => void;
	disabled?: boolean;
	/** Aviso bajo la descripción (p. ej. por qué está desactivada). */
	note?: string;
}

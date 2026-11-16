export interface PresetCardProps {
	/** Nombre del grupo de radios al que pertenece la tarjeta. */
	name: string;
	value: string;
	label: string;
	description: string;
	colors: { background: string; accent: string; text: string };
	selected: boolean;
	onSelect: () => void;
}

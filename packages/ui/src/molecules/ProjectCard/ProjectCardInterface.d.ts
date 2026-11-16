export interface ProjectCardProps {
	name: string;
	description: string;
	presetLabel: string;
	languages: readonly string[];
	colors: { background: string; accent: string };
	onOpen: () => void;
}

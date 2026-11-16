import type { BadgeTone } from "../../atoms/Badge/BadgeInterface";

export interface VideoListItem {
	id: string;
	title: string;
	subtitle: string;
	status: { label: string; tone: BadgeTone };
}

export interface VideoListProps {
	items: readonly VideoListItem[];
	onOpen: (id: string) => void;
}

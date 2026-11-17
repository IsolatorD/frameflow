export interface OverlayListItem {
	id: string;
	type: "text" | "image" | "video";
	label: string;
	/** "0:03–0:06 · Capa 1" */
	detail: string;
}

export interface OverlayListProps {
	items: readonly OverlayListItem[];
	selectedId: string | null;
	onSelect: (id: string) => void;
	onAddText: () => void;
	onAddMedia: () => void;
	adding?: boolean;
	locked?: boolean;
	error?: string;
}

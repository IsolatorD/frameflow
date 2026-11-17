export interface TabItem {
	id: string;
	label: string;
	/** Marca opcional (p. ej. "●" para cambios sin guardar). */
	badge?: string;
}

export interface TabsProps {
	label: string;
	tabs: readonly TabItem[];
	active: string;
	onChange: (id: string) => void;
	/** Prefijo de ids para enlazar pestañas y paneles (aria-controls). */
	idPrefix: string;
}

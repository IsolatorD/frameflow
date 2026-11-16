import type { ReactNode } from "react";

export interface AppShellNavItem {
	id: string;
	label: string;
	active?: boolean;
	/** Punto de color a la izquierda (p. ej. el color del proyecto). */
	dotColor?: string;
	/** Etiqueta corta a la derecha (p. ej. "Pronto"). */
	badge?: string;
	onSelect: () => void;
}

export interface AppShellNavGroup {
	id: string;
	label?: string;
	items: readonly AppShellNavItem[];
}

export interface AppShellProps {
	nav: readonly AppShellNavGroup[];
	title: string;
	subtitle?: string;
	/** Contenido sobre el título (p. ej. una ruta de migas). */
	eyebrow?: ReactNode;
	actions?: ReactNode;
	children: ReactNode;
}

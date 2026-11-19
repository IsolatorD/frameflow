import type { BrandPreviewTheme } from "../BrandPreview/BrandPreviewInterface";

export interface ReferenceSwatch {
	color: string;
	/** Parte de la referencia que ocupa (0–1). */
	share: number;
}

export interface ReferenceColorsResult {
	swatches: ReferenceSwatch[];
	theme: BrandPreviewTheme;
}

export interface ReferenceColorsProps {
	/** Prefijo único para los ids. */
	id: string;
	/** Lee la imagen o el video (en el equipo) y devuelve su paleta y los colores propuestos. */
	onRead: (file: File) => Promise<ReferenceColorsResult>;
	/** Usar los colores propuestos (quedan como cambios sin guardar). */
	onUse: (theme: BrandPreviewTheme) => void;
}

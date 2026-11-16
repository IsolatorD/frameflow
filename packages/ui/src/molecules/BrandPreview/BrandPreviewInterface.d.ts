export interface BrandPreviewTheme {
	background: string;
	text: string;
	accent: string;
	muted: string;
}

export interface BrandPreviewProps {
	theme: BrandPreviewTheme;
	fontFamily: string;
	/** "sm": miniatura del panel. "lg": vista previa del editor, con subtítulos y CTA. */
	size?: "sm" | "lg";
	captions?: { enabled: boolean; maxWordsPerPage: number };
	ctaText?: string;
}

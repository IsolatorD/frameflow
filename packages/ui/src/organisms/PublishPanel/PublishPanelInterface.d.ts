export interface PublishPost {
	title: string;
	caption: string;
	hashtags: string[];
}

export interface PublishItem {
	id: string;
	/** "YouTube Shorts" */
	label: string;
	/** Color de la red (para el punto de la pestaña). */
	color: string;
	/** Máximo del título; null = esta red no usa título. */
	titleMax: number | null;
	captionMax: number;
	/** Caracteres visibles antes de "más". */
	captionVisible: number;
	hashtagsRecommended: number;
	/** Nota de la red (p. ej. dónde salen los hashtags). */
	note?: string;
	/** Nombre de la página de subida ("YouTube Studio"). */
	uploadLabel: string;
	post: PublishPost;
	/** Longitud del texto final (texto + hashtags). */
	composedLength: number;
	issues: { level: "error" | "warning"; message: string }[];
	status: "draft" | "exported" | "published";
	exportPath: string | null;
	/** La carpeta exportada es de una versión anterior del video. */
	exportOutdated: boolean;
	url: string | null;
}

export interface PublishPanelProps {
	items: readonly PublishItem[];
	active: string;
	onActiveChange: (id: string) => void;
	onChange: (id: string, post: PublishPost) => void;
	/** "#a #b" → hashtags válidos (la app los normaliza). */
	parseHashtags: (text: string) => string[];
	onCopy: (id: string) => void;
	onExport: (id: string) => void;
	onOpenUpload: (id: string) => void;
	onReveal: (path: string) => void;
	onMarkPublished: (id: string, url: string | null) => void;
	onImprove: () => void;
	exporting: string | null;
	improving: boolean;
	/** "Usa Qwen3 14B (en este equipo)" o por qué no hay IA. */
	aiNote: string;
	aiAvailable: boolean;
	/** Mensaje tras copiar ("Texto copiado"). */
	copied: string | null;
	saving: boolean;
	error?: string;
}

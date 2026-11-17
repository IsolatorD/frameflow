export interface UpdateNoticeProps {
	version: string;
	status: "available" | "downloading" | "ready";
	/** 0–1 durante la descarga. */
	progress?: number;
	/** Se instala desde la app; si no (macOS sin firma), el botón abre la página de descarga. */
	canInstall: boolean;
	/** Hay videos generándose: no se puede reiniciar todavía. */
	busy?: boolean;
	onDownload: () => void;
	onInstall: () => void;
	onDetails?: () => void;
}

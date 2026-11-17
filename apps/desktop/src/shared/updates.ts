/** Estado de las actualizaciones de la app que ve la interfaz. */
export type UpdateState = {
	/** Versión instalada. */
	current: string;
	status:
		| "disabled" // en desarrollo o desactivadas
		| "idle"
		| "checking"
		| "none" // ya es la última
		| "available"
		| "downloading"
		| "ready" // descargada: falta reiniciar
		| "error";
	/** Versión nueva disponible. */
	version?: string;
	/** Novedades de la versión (texto de la release). */
	notes?: string;
	/** 0–1 durante la descarga. */
	progress?: number;
	/**
	 * Se puede instalar desde la app. En macOS hace falta que la app esté firmada: mientras no lo
	 * esté, se avisa y se abre la página de descarga.
	 */
	canInstall: boolean;
	/** Página de la versión nueva (GitHub Releases). */
	releaseUrl?: string;
	error?: string;
	/** Hay videos generándose: reiniciar ahora los interrumpiría. */
	busy?: boolean;
};

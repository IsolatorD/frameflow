export type PlatformTileStatus = "connected" | "disconnected" | "export-only";

export interface PlatformTileProps {
	name: string;
	/** Color de marca de la red, para el distintivo. */
	color: string;
	status: PlatformTileStatus;
	/** Texto bajo el nombre (p. ej. "@astroinfo" o "Disponible en la fase 2"). */
	detail: string;
}

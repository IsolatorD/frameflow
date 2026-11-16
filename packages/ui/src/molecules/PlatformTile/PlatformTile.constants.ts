import type { PlatformTileStatus } from "./PlatformTileInterface";

export const STATUS_LABEL: Record<PlatformTileStatus, string> = {
	connected: "Conectada",
	disconnected: "Sin conectar",
	"export-only": "Solo exportar",
};

export const STATUS_CLASS: Record<PlatformTileStatus, string> = {
	connected: "bg-emerald-500/10 text-emerald-300",
	disconnected: "bg-white/5 text-zinc-400",
	"export-only": "bg-amber-500/10 text-amber-300",
};

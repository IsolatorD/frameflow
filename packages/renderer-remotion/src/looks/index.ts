import { resolveVisualStyle, type VisualStyle } from "@frameflow/core/look";
import type { Storyboard } from "@frameflow/core/storyboard";
import type { ComponentType } from "react";
import { HologramStage } from "./hologram/HologramStage";
import { PictogramStage } from "./pictogram/PictogramStage";
import { ScaleZoomStage } from "./scale-zoom/ScaleZoomStage";

// Registro de estilos visuales del renderer (el catálogo está en core/look). Un estilo puede
// aportar un "escenario": una capa que dura todo el video y dibuja las escenas a su manera.
// "Libre" no tiene escenario: las escenas se dibujan con KineticText y Stat de siempre.

export type StageProps = { storyboard: Storyboard; options: Record<string, string> };

/**
 * `draws`: tipos de escena que dibuja el escenario; los demás se dibujan encima, en placa
 * (útil para un estilo nuevo que aún no los tenga todos). Sin él, los dibuja todos.
 */
const STAGES: Record<string, { Stage: ComponentType<StageProps>; draws?: readonly string[] }> = {
	hologram: { Stage: HologramStage },
	"scale-zoom": { Stage: ScaleZoomStage },
	pictogram: { Stage: PictogramStage },
};

/** El escenario del estilo del video, o null si las escenas se dibujan como siempre. */
export function stageFor(style: VisualStyle | undefined) {
	const resolved = resolveVisualStyle(style);
	const entry = STAGES[resolved.id];
	return entry
		? {
				Stage: entry.Stage,
				options: resolved.options,
				draws: (type: string) => !entry.draws || entry.draws.includes(type),
			}
		: null;
}

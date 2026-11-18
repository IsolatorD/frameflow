import { resolveVisualStyle, type VisualStyle } from "@frameflow/core/look";
import type { Storyboard } from "@frameflow/core/storyboard";
import type { ComponentType } from "react";
import { HologramStage } from "./hologram/HologramStage";

// Registro de estilos visuales del renderer (el catálogo está en core/look). Un estilo puede
// aportar un "escenario": una capa que dura todo el video y dibuja las escenas a su manera.
// "Libre" no tiene escenario: las escenas se dibujan con KineticText y Stat de siempre.

export type StageProps = { storyboard: Storyboard; options: Record<string, string> };

const STAGES: Record<string, ComponentType<StageProps>> = {
	hologram: HologramStage,
};

/** El escenario del estilo del video, o null si las escenas se dibujan como siempre. */
export function stageFor(style: VisualStyle | undefined) {
	const resolved = resolveVisualStyle(style);
	const Stage = STAGES[resolved.id];
	return Stage ? { Stage, options: resolved.options } : null;
}

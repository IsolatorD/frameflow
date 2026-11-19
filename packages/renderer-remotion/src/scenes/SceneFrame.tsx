import type { Theme } from "@frameflow/core/storyboard";
import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";

// Envoltura común de las escenas: fondo del tema y contenido centrado.
// Las transiciones (fundidos, deslizamientos) las aplica el clip, no la escena.
// Con `plate` (escena dibujada encima de un estilo visual que no la dibuja él), el fondo es
// transparente y el contenido va sobre una placa del color de fondo para que se lea.
export const SceneFrame = ({
	theme,
	children,
	plate = false,
}: {
	theme: Theme;
	children: ReactNode;
	plate?: boolean;
}) => (
	<AbsoluteFill
		style={{
			backgroundColor: plate ? "transparent" : theme.background,
			justifyContent: "center",
			alignItems: "center",
			padding: 90,
		}}
	>
		<div
			style={
				plate
					? {
							width: "100%",
							padding: "56px 60px",
							borderRadius: 40,
							backgroundColor: `color-mix(in srgb, ${theme.background} 88%, transparent)`,
							boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
						}
					: { width: "100%" }
			}
		>
			{children}
		</div>
	</AbsoluteFill>
);

/** Entrada escalonada de los elementos de una lista (0 → 1). */
export const STAGGER_SECONDS = 0.4;

import type { Theme } from "@frameflow/core/storyboard";
import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";

// Envoltura común de las escenas: fondo del tema y contenido centrado.
// Las transiciones (fundidos, deslizamientos) las aplica el clip, no la escena.
export const SceneFrame = ({ theme, children }: { theme: Theme; children: ReactNode }) => (
	<AbsoluteFill
		style={{
			backgroundColor: theme.background,
			justifyContent: "center",
			alignItems: "center",
			padding: 90,
		}}
	>
		<div style={{ width: "100%" }}>{children}</div>
	</AbsoluteFill>
);

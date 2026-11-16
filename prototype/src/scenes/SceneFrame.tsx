import type { ReactNode } from "react";
import {
	AbsoluteFill,
	interpolate,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import type { Theme } from "../storyboard/schema";

// Envoltura común: fondo del tema + fundido de salida al final de la escena.
export const SceneFrame = ({
	theme,
	children,
}: {
	theme: Theme;
	children: ReactNode;
}) => {
	const frame = useCurrentFrame();
	const { durationInFrames, fps } = useVideoConfig();
	const fadeOut = interpolate(
		frame,
		[durationInFrames - fps * 0.4, durationInFrames],
		[1, 0],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	return (
		<AbsoluteFill
			style={{
				backgroundColor: theme.background,
				justifyContent: "center",
				alignItems: "center",
				padding: 90,
			}}
		>
			<div style={{ opacity: fadeOut, width: "100%" }}>{children}</div>
		</AbsoluteFill>
	);
};

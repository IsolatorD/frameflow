import type { KineticTextContent, Theme } from "@frameflow/core/storyboard";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneFrame } from "./SceneFrame";

const STAGGER_SECONDS = 0.35;

export const KineticText = ({ content, theme }: { content: KineticTextContent; theme: Theme }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	return (
		<SceneFrame theme={theme}>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 30,
				}}
			>
				{content.lines.map((line, i) => {
					const enter = spring({
						frame: frame - i * STAGGER_SECONDS * fps,
						fps,
						config: { damping: 12, mass: 0.6 },
					});
					const y = interpolate(enter, [0, 1], [80, 0]);

					return (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: las líneas de una escena son fijas durante el render; la posición es su identidad
							key={`${i}-${line.text}`}
							style={{
								opacity: Math.min(enter, 1),
								transform: `translateY(${y}px) scale(${0.6 + enter * 0.4})`,
								color: line.emphasis ? theme.accent : theme.text,
								fontSize: line.emphasis ? 140 : 84,
								fontWeight: line.emphasis ? 800 : 600,
								lineHeight: 1.1,
								textAlign: "center",
							}}
						>
							{line.text}
						</div>
					);
				})}
			</div>
		</SceneFrame>
	);
};

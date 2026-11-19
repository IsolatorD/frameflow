import type { Theme, VisualClip } from "@frameflow/core/storyboard";
import { AbsoluteFill, Img, OffthreadVideo, useVideoConfig } from "remotion";
import { KineticText } from "../scenes/KineticText";
import { Chart, Compare, Steps, Timeline } from "../scenes/ListScenes";
import { Stat } from "../scenes/Stat";
import { ClipLayer } from "./ClipLayer";
import { useResolveSrc } from "./resolveSrc";

/** Un color de estilo puede ser el nombre de un color del tema ("accent") o un #RRGGBB. */
const themeColor = (value: string, theme: Theme) =>
	value in theme ? theme[value as keyof Theme] : value;

// Registro tipo de clip → componente. Añadir un tipo nuevo = añadir un caso.
const Content = ({ clip, theme, plate }: { clip: VisualClip; theme: Theme; plate: boolean }) => {
	const { fps } = useVideoConfig();
	const resolveSrc = useResolveSrc();
	switch (clip.type) {
		case "scene": {
			const sceneTheme = { ...theme, ...clip.theme };
			const c = clip.content;
			switch (c.type) {
				case "kinetic-text":
					return <KineticText content={c} theme={sceneTheme} />;
				case "stat":
					return <Stat content={c} theme={sceneTheme} />;
				case "steps":
					return <Steps content={c} theme={sceneTheme} plate={plate} />;
				case "timeline":
					return <Timeline content={c} theme={sceneTheme} plate={plate} />;
				case "compare":
					return <Compare content={c} theme={sceneTheme} plate={plate} />;
				case "chart":
					return <Chart content={c} theme={sceneTheme} plate={plate} />;
			}
			return null;
		}
		case "text":
			return (
				<AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 60 }}>
					<div
						data-clip-box
						style={{
							fontSize: clip.style.fontSize,
							fontWeight: clip.style.fontWeight,
							color: themeColor(clip.style.color, theme),
							backgroundColor: clip.style.background
								? themeColor(clip.style.background, theme)
								: undefined,
							padding: clip.style.background ? "0.2em 0.6em" : 0,
							borderRadius: "0.4em",
							textAlign: clip.style.align,
							lineHeight: 1.1,
						}}
					>
						{clip.text}
					</div>
				</AbsoluteFill>
			);
		case "image":
			return (
				<Img
					src={resolveSrc(clip.src)}
					style={{ width: "100%", height: "100%", objectFit: clip.fit }}
				/>
			);
		case "video":
			return (
				<OffthreadVideo
					src={resolveSrc(clip.src)}
					trimBefore={Math.round(clip.trimStart * fps)}
					playbackRate={clip.playbackRate}
					volume={clip.volume}
					style={{ width: "100%", height: "100%", objectFit: clip.fit }}
				/>
			);
	}
};

/** `plate`: la escena se dibuja encima de un estilo visual (fondo transparente y placa). */
export const VisualClipView = ({
	clip,
	theme,
	plate = false,
}: {
	clip: VisualClip;
	theme: Theme;
	plate?: boolean;
}) => (
	<ClipLayer
		clipId={clip.id}
		transform={clip.transform}
		keyframes={clip.keyframes}
		enter={clip.enter}
		exit={clip.exit}
	>
		<Content clip={clip} theme={theme} plate={plate} />
	</ClipLayer>
);

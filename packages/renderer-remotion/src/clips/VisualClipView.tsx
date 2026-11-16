import type { Theme, VisualClip } from "@frameflow/core/storyboard";
import { AbsoluteFill, Img, OffthreadVideo, useVideoConfig } from "remotion";
import { KineticText } from "../scenes/KineticText";
import { Stat } from "../scenes/Stat";
import { ClipLayer } from "./ClipLayer";
import { resolveSrc } from "./resolveSrc";

/** Un color de estilo puede ser el nombre de un color del tema ("accent") o un #RRGGBB. */
const themeColor = (value: string, theme: Theme) =>
	value in theme ? theme[value as keyof Theme] : value;

// Registro tipo de clip → componente. Añadir un tipo nuevo = añadir un caso.
const Content = ({ clip, theme }: { clip: VisualClip; theme: Theme }) => {
	const { fps } = useVideoConfig();
	switch (clip.type) {
		case "scene": {
			const sceneTheme = { ...theme, ...clip.theme };
			return clip.content.type === "kinetic-text" ? (
				<KineticText content={clip.content} theme={sceneTheme} />
			) : (
				<Stat content={clip.content} theme={sceneTheme} />
			);
		}
		case "text":
			return (
				<AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 60 }}>
					<div
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

export const VisualClipView = ({ clip, theme }: { clip: VisualClip; theme: Theme }) => (
	<ClipLayer transform={clip.transform} enter={clip.enter} exit={clip.exit}>
		<Content clip={clip} theme={theme} />
	</ClipLayer>
);

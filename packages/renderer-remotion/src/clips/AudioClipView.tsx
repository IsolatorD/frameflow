import type { AudioClip } from "@frameflow/core/storyboard";
import { Audio, interpolate, useVideoConfig } from "remotion";
import { resolveSrc } from "./resolveSrc";

/** Audio con recorte, volumen y fundidos de entrada/salida. */
export const AudioClipView = ({ clip }: { clip: AudioClip }) => {
	const { fps, durationInFrames } = useVideoConfig();
	const fadeIn = clip.fadeIn * fps;
	const fadeOut = clip.fadeOut * fps;
	return (
		<Audio
			src={resolveSrc(clip.src)}
			trimBefore={Math.round(clip.trimStart * fps)}
			volume={(f) => {
				const inGain = fadeIn > 0 ? Math.min(1, f / fadeIn) : 1;
				const outGain =
					fadeOut > 0
						? interpolate(f, [durationInFrames - fadeOut, durationInFrames], [1, 0], {
								extrapolateLeft: "clamp",
								extrapolateRight: "clamp",
							})
						: 1;
				return clip.volume * inGain * outGain;
			}}
		/>
	);
};

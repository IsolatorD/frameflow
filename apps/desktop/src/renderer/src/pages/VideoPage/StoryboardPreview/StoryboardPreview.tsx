import { dimensionsFor, type Storyboard as StoryboardData } from "@frameflow/core/storyboard";
import { storyboardDuration, toFrames } from "@frameflow/core/storyboard/timeline";
import { Storyboard } from "@frameflow/renderer-remotion/Storyboard";
import { Player } from "@remotion/player";

/** Vista previa en vivo del storyboard con el reproductor de Remotion (sin renderizar). */
export function StoryboardPreview({
	storyboard,
	mediaBaseUrl,
}: {
	storyboard: StoryboardData;
	mediaBaseUrl: string;
}) {
	const { width, height } = dimensionsFor(storyboard.format);
	const durationInFrames = Math.max(1, toFrames(storyboardDuration(storyboard), storyboard.fps));
	return (
		<Player
			component={Storyboard}
			inputProps={{ storyboard, mediaBaseUrl }}
			durationInFrames={durationInFrames}
			// Empieza en el segundo 1: en el fotograma 0 las animaciones de entrada aún no se ven.
			initialFrame={Math.min(storyboard.fps, durationInFrames - 1)}
			fps={storyboard.fps}
			compositionWidth={width}
			compositionHeight={height}
			controls
			style={{
				width: "100%",
				aspectRatio: `${width} / ${height}`,
				borderRadius: 12,
				overflow: "hidden",
			}}
		/>
	);
}

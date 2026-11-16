import { dimensionsFor, type Storyboard as StoryboardData } from "@frameflow/core/storyboard";
import { parseStoryboard, storyboardDuration, toFrames } from "@frameflow/core/storyboard/timeline";
import { Composition } from "remotion";
import demo from "../fixtures/demo-v2.json";
import { Storyboard } from "./Storyboard";

type Props = { storyboard: StoryboardData };

export const RemotionRoot = () => (
	<Composition
		id="Storyboard"
		component={Storyboard}
		defaultProps={{ storyboard: parseStoryboard(demo) } satisfies Props}
		// Duración, fps y tamaño salen del storyboard, no están fijos en el código.
		calculateMetadata={({ props }: { props: Props }) => {
			// Las props de --props=archivo llegan crudas: se validan (y migran si son v1) aquí.
			const storyboard = parseStoryboard(props.storyboard);
			return {
				props: { storyboard },
				fps: storyboard.fps,
				durationInFrames: Math.max(1, toFrames(storyboardDuration(storyboard), storyboard.fps)),
				...dimensionsFor(storyboard.format),
				defaultOutName: storyboard.title,
			};
		}}
	/>
);

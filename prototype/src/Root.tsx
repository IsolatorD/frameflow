import { Composition } from "remotion";
import { z } from "zod";
import { Storyboard } from "./Storyboard";
import demo from "./storyboard/demo.json";
import { dimensionsFor, storyboardSchema } from "./storyboard/schema";

const propsSchema = z.object({ storyboard: storyboardSchema });

export const RemotionRoot = () => (
	<Composition
		id="Storyboard"
		component={Storyboard}
		schema={propsSchema}
		defaultProps={{ storyboard: storyboardSchema.parse(demo) }}
		// Duración, fps y tamaño salen del JSON, no están fijos en el código.
		calculateMetadata={({ props }) => {
			// Las props de --props=archivo llegan crudas: validamos y aplicamos defaults aquí.
			const storyboard = storyboardSchema.parse(props.storyboard);
			const seconds = storyboard.scenes.reduce(
				(total, s) => total + s.durationInSeconds,
				0,
			);
			return {
				props: { storyboard },
				fps: storyboard.fps,
				durationInFrames: storyboard.scenes.reduce(
					(total, s) => total + Math.round(s.durationInSeconds * storyboard.fps),
					0,
				),
				...dimensionsFor(storyboard.format),
				defaultOutName: `${storyboard.title} (${seconds}s)`,
			};
		}}
	/>
);

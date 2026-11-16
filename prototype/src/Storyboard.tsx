import { loadFont } from "@remotion/google-fonts/Montserrat";
import { AbsoluteFill, Audio, Series, staticFile } from "remotion";
import { Captions } from "./captions/Captions";
import { KineticText } from "./scenes/KineticText";
import { Stat } from "./scenes/Stat";
import type { Scene, Storyboard as StoryboardData, Theme } from "./storyboard/schema";

const { fontFamily } = loadFont("normal", {
	weights: ["600", "800"],
	subsets: ["latin", "latin-ext"],
});

// Registro de tipos de escena → componente. Añadir un estilo nuevo = añadir una entrada.
const renderScene = (scene: Scene, theme: Theme) => {
	switch (scene.type) {
		case "kinetic-text":
			return <KineticText scene={scene} theme={theme} />;
		case "stat":
			return <Stat scene={scene} theme={theme} />;
	}
};

export const Storyboard = ({ storyboard }: { storyboard: StoryboardData }) => (
	<AbsoluteFill style={{ fontFamily, backgroundColor: storyboard.theme.background }}>
		<Series>
			{storyboard.scenes.map((scene, i) => (
				<Series.Sequence
					key={`${i}-${scene.type}`}
					durationInFrames={Math.round(scene.durationInSeconds * storyboard.fps)}
				>
					{renderScene(scene, storyboard.theme)}
					{scene.voice ? <Audio src={staticFile(scene.voice.src)} /> : null}
					{storyboard.captions.enabled && scene.voice?.words ? (
						<Captions
							words={scene.voice.words}
							maxWordsPerPage={storyboard.captions.maxWordsPerPage}
							theme={storyboard.theme}
						/>
					) : null}
				</Series.Sequence>
			))}
		</Series>
	</AbsoluteFill>
);

import type { Storyboard as StoryboardData } from "@frameflow/core/storyboard";
import { captionWords, toFrames } from "@frameflow/core/storyboard/timeline";
import { AbsoluteFill, Sequence } from "remotion";
import { Captions } from "./captions/Captions";
import { AudioClipView } from "./clips/AudioClipView";
import { MediaBaseContext } from "./clips/resolveSrc";
import { VisualClipView } from "./clips/VisualClipView";
import { fontFor } from "./fonts";
import { stageFor } from "./looks";

/**
 * Dibuja la línea de tiempo: cada pista es una capa (la última, encima) y cada clip
 * un <Sequence> en su posición. Los subtítulos van siempre por encima de todo.
 */
export type StoryboardProps = {
	storyboard: StoryboardData;
	/** Base URL de los recursos del proyecto (voces, imágenes…). */
	mediaBaseUrl?: string;
};

export const Storyboard = ({ storyboard, mediaBaseUrl }: StoryboardProps) => {
	const { fps, style } = storyboard;
	// Estilo visual: si tiene escenario, dibuja las escenas él y las escenas planas no se pintan.
	const stage = stageFor(style.visualStyle);
	const at = (clip: { id: string; start: number; duration: number }) => ({
		from: toFrames(clip.start, fps),
		durationInFrames: Math.max(1, toFrames(clip.duration, fps)),
		name: clip.id,
	});

	return (
		<MediaBaseContext.Provider value={mediaBaseUrl}>
			<AbsoluteFill
				style={{ fontFamily: fontFor(style.fontFamily), backgroundColor: style.theme.background }}
			>
				{stage ? <stage.Stage storyboard={storyboard} options={stage.options} /> : null}
				{storyboard.tracks.map((track) =>
					track.hidden ? null : (
						<AbsoluteFill key={track.id}>
							{track.kind === "visual"
								? track.clips.map((clip) => (
										<Sequence key={clip.id} {...at(clip)} layout="none">
											{stage && clip.type === "scene" ? null : (
												<VisualClipView clip={clip} theme={style.theme} />
											)}
										</Sequence>
									))
								: track.muted
									? null
									: track.clips.map((clip) => (
											<Sequence key={clip.id} {...at(clip)} layout="none">
												<AudioClipView clip={clip} />
											</Sequence>
										))}
						</AbsoluteFill>
					),
				)}
				{style.captions.enabled ? (
					<Captions
						words={captionWords(storyboard)}
						maxWordsPerPage={style.captions.maxWordsPerPage}
						theme={style.theme}
					/>
				) : null}
			</AbsoluteFill>
		</MediaBaseContext.Provider>
	);
};

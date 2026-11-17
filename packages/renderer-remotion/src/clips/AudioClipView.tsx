import type { AudioClip } from "@frameflow/core/storyboard";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { useEffect, useState } from "react";
import {
	Audio,
	continueRender,
	delayRender,
	interpolate,
	Sequence,
	useVideoConfig,
} from "remotion";
import { useResolveSrc } from "./resolveSrc";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Audio con recorte, volumen y fundidos de entrada/salida.
 *
 * El bucle se hace aquí (varias <Sequence> seguidas) y no con `loop` de Remotion: con `loop`, el
 * fotograma que recibe `volume` se reinicia en cada vuelta, así que la entrada suave se repetía en
 * cada vuelta y la salida suave nunca llegaba. Aquí los fundidos usan el tiempo de todo el clip.
 */
export const AudioClipView = ({ clip }: { clip: AudioClip }) => {
	const { fps, durationInFrames } = useVideoConfig();
	const resolveSrc = useResolveSrc();
	const src = resolveSrc(clip.src);
	const trimFrames = Math.round(clip.trimStart * fps);
	const fadeIn = clip.fadeIn * fps;
	const fadeOut = clip.fadeOut * fps;
	const [mediaSeconds, setMediaSeconds] = useState<number | null>(null);

	useEffect(() => {
		if (!clip.loop) return;
		const handle = delayRender(`Duración de ${clip.src}`);
		getAudioDurationInSeconds(src)
			.then(setMediaSeconds)
			.catch(() => setMediaSeconds(Number.POSITIVE_INFINITY)) // sin duración: suena una vez
			.finally(() => continueRender(handle));
	}, [clip.loop, clip.src, src]);

	/** Ganancia en el fotograma `f` del clip completo (no de la vuelta). */
	const gain = (f: number) => {
		const inGain = fadeIn > 0 ? Math.min(1, f / fadeIn) : 1;
		const outGain =
			fadeOut > 0
				? interpolate(f, [durationInFrames - fadeOut, durationInFrames], [1, 0], clamp)
				: 1;
		return clip.volume * inGain * outGain;
	};

	if (!clip.loop) return <Audio src={src} trimBefore={trimFrames} volume={gain} />;
	if (mediaSeconds === null) return null;

	const loopFrames = Math.max(1, Math.floor(mediaSeconds * fps) - trimFrames);
	const rounds = Number.isFinite(loopFrames) ? Math.ceil(durationInFrames / loopFrames) : 1;
	return (
		<>
			{Array.from({ length: rounds }, (_, i) => {
				const from = i * loopFrames;
				return (
					<Sequence
						// biome-ignore lint/suspicious/noArrayIndexKey: cada vuelta del bucle es su posición
						key={i}
						from={from}
						durationInFrames={Math.min(loopFrames, durationInFrames - from)}
						layout="none"
					>
						<Audio src={src} trimBefore={trimFrames} volume={(f) => gain(f + from)} />
					</Sequence>
				);
			})}
		</>
	);
};

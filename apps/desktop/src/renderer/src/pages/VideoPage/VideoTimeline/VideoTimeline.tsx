import type { Storyboard } from "@frameflow/core/storyboard";
import { findClip, storyboardDuration } from "@frameflow/core/storyboard/timeline";
import { Timeline } from "@frameflow/ui/src/organisms/Timeline/Timeline";
import type { PlayerRef } from "@remotion/player";
import { type RefObject, useEffect, useMemo, useState } from "react";
import { type ClipTarget, clipTarget, timelineTracks } from "./VideoTimeline.constants";

/**
 * Línea de tiempo enlazada al reproductor: sigue su posición (evento frameupdate) y lo mueve.
 * Lleva su propio estado de tiempo para no re-renderizar toda la página 30 veces por segundo.
 */
export function VideoTimeline({
	storyboard,
	voicedSceneIds,
	playerRef,
	selectedClipId,
	onSelect,
}: {
	storyboard: Storyboard;
	voicedSceneIds: readonly string[];
	playerRef: RefObject<PlayerRef | null>;
	selectedClipId: string | null;
	onSelect: (clipId: string, target: ClipTarget) => void;
}) {
	const [time, setTime] = useState(0);
	const fps = storyboard.fps;

	useEffect(() => {
		const player = playerRef.current;
		if (!player) return;
		const update = () => setTime(player.getCurrentFrame() / fps);
		update();
		player.addEventListener("frameupdate", update);
		player.addEventListener("seeked", update);
		return () => {
			player.removeEventListener("frameupdate", update);
			player.removeEventListener("seeked", update);
		};
	}, [playerRef, fps]);

	const tracks = useMemo(
		() => timelineTracks(storyboard, voicedSceneIds),
		[storyboard, voicedSceneIds],
	);
	const seek = (seconds: number) => {
		playerRef.current?.seekTo(Math.round(seconds * fps));
		setTime(seconds);
	};

	return (
		<Timeline
			tracks={tracks}
			duration={storyboardDuration(storyboard)}
			time={time}
			selectedClipId={selectedClipId}
			onSeek={seek}
			onSelectClip={(clipId) => {
				const clip = findClip(storyboard, clipId)?.clip;
				if (clip) seek(clip.start);
				onSelect(clipId, clipTarget(storyboard, clipId));
			}}
		/>
	);
}

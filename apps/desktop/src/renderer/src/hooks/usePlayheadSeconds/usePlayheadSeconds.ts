import type { PlayerRef } from "@remotion/player";
import { type RefObject, useEffect, useState } from "react";

/**
 * Segundo actual del reproductor, como estado de React. Solo se suscribe si `enabled`
 * (evita re-renderizar la página 30 veces por segundo cuando no hace falta).
 */
export function usePlayheadSeconds(
	playerRef: RefObject<PlayerRef | null>,
	fps: number,
	enabled: boolean,
) {
	const [seconds, setSeconds] = useState(0);
	useEffect(() => {
		const player = playerRef.current;
		if (!enabled || !player) return;
		const update = () => setSeconds(player.getCurrentFrame() / fps);
		update();
		player.addEventListener("frameupdate", update);
		player.addEventListener("seeked", update);
		return () => {
			player.removeEventListener("frameupdate", update);
			player.removeEventListener("seeked", update);
		};
	}, [playerRef, fps, enabled]);
	return seconds;
}

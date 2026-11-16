import type { JobEvent } from "@frameflow/core/video";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { videosService } from "../../services/videosService/videosService";
import { VIDEOS_KEY } from "../useVideos/useVideos";

/**
 * Último evento de progreso de un video (guion, voz o render).
 * Cada evento refresca los datos de videos: los estados y versiones cambian en el proceso principal.
 */
export function useJobEvents(videoId: string | undefined): JobEvent | null {
	const queryClient = useQueryClient();
	const [last, setLast] = useState<JobEvent | null>(null);

	useEffect(() => {
		setLast(null);
		return videosService.onJobEvent((event) => {
			if (event.videoId !== videoId) return;
			setLast(event);
			// Los "running" solo cambian el progreso; refrescar solo al cambiar de paso o terminar.
			if (event.state !== "running" || event.progress === null) {
				void queryClient.invalidateQueries({ queryKey: VIDEOS_KEY });
			}
		});
	}, [videoId, queryClient]);

	return last;
}

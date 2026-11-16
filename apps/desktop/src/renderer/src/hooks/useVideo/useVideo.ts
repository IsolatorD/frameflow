import { useQuery } from "@tanstack/react-query";
import { videosService } from "../../services/videosService/videosService";
import { VIDEOS_KEY } from "../useVideos/useVideos";

export const videoKey = (id: string | undefined) => [...VIDEOS_KEY, "detail", id] as const;

export function useVideo(id: string | undefined) {
	return useQuery({
		queryKey: videoKey(id),
		queryFn: () => videosService.get(id ?? ""),
		enabled: Boolean(id),
	});
}

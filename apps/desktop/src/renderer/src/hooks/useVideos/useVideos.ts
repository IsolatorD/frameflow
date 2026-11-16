import { useQuery } from "@tanstack/react-query";
import { videosService } from "../../services/videosService/videosService";

export const VIDEOS_KEY = ["videos"] as const;

export function useVideos(projectId: string | undefined) {
	return useQuery({
		queryKey: [...VIDEOS_KEY, "list", projectId],
		queryFn: () => videosService.list(projectId ?? ""),
		enabled: Boolean(projectId),
	});
}

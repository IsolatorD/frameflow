import { useQuery } from "@tanstack/react-query";
import { videosService } from "../../services/videosService/videosService";

export function useMediaBaseUrl() {
	return useQuery({
		queryKey: ["app", "media-base-url"],
		queryFn: videosService.mediaBaseUrl,
		staleTime: Number.POSITIVE_INFINITY,
	});
}

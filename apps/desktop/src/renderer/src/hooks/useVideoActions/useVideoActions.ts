import type { Script, VideoSettings } from "@frameflow/core/script";
import type { CreateVideoInput } from "@frameflow/core/video";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { videosService } from "../../services/videosService/videosService";
import { videoKey } from "../useVideo/useVideo";
import { VIDEOS_KEY } from "../useVideos/useVideos";

export function useCreateVideo() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateVideoInput) => videosService.create(input),
		onSuccess: (video) => {
			queryClient.setQueryData(videoKey(video.id), video);
			return queryClient.invalidateQueries({ queryKey: [...VIDEOS_KEY, "list"] });
		},
	});
}

/** Acciones sobre un video: guardar guion, generar voz, renderizar, cancelar, abrir el MP4. */
export function useVideoActions(videoId: string) {
	const queryClient = useQueryClient();
	const refresh = () => queryClient.invalidateQueries({ queryKey: VIDEOS_KEY });
	return {
		saveScript: useMutation({
			mutationFn: (script: Script) => videosService.saveScript(videoId, script),
			onSuccess: (video) => {
				queryClient.setQueryData(videoKey(videoId), video);
				return queryClient.invalidateQueries({ queryKey: [...VIDEOS_KEY, "list"] });
			},
		}),
		saveSettings: useMutation({
			mutationFn: (settings: VideoSettings) => videosService.saveSettings(videoId, settings),
			onSuccess: (video) => {
				queryClient.setQueryData(videoKey(videoId), video);
				return queryClient.invalidateQueries({ queryKey: [...VIDEOS_KEY, "list"] });
			},
		}),
		pickMusic: useMutation({ mutationFn: () => videosService.pickMusic(videoId) }),
		generateVoice: useMutation({
			mutationFn: () => videosService.generateVoice(videoId),
			onSettled: refresh,
		}),
		render: useMutation({ mutationFn: () => videosService.render(videoId), onSettled: refresh }),
		cancel: useMutation({ mutationFn: () => videosService.cancel(videoId) }),
		openRender: useMutation({
			mutationFn: (how: "open" | "reveal") => videosService.openRender(videoId, how),
		}),
	};
}

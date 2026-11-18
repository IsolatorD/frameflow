import type { Script, VideoSettings } from "@frameflow/core/script";
import type { CaptionEdit, TimelineEdit } from "@frameflow/core/script/edit";
import type { OverlayOp } from "@frameflow/core/script/overlays";
import type { CreateVideoInput, VideoDetail } from "@frameflow/core/video";
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
	// Las ediciones devuelven el video guardado: se escribe en la caché y se refresca la lista.
	const saved = (video: VideoDetail) => {
		queryClient.setQueryData(videoKey(videoId), video);
		return queryClient.invalidateQueries({ queryKey: [...VIDEOS_KEY, "list"] });
	};
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
		editTimeline: useMutation({
			mutationFn: (edit: TimelineEdit) => videosService.editTimeline(videoId, edit),
			onSuccess: saved,
		}),
		saveCaptions: useMutation({
			mutationFn: (args: { sceneId: string; words: CaptionEdit }) =>
				videosService.saveCaptions(videoId, args.sceneId, args.words),
			onSuccess: saved,
		}),
		restoreVersion: useMutation({
			mutationFn: (number: number) => videosService.restoreVersion(videoId, number),
			onSuccess: saved,
		}),
		editOverlays: useMutation({
			mutationFn: (op: OverlayOp) => videosService.editOverlays(videoId, op),
			onSuccess: ({ video }) => saved(video),
		}),
		pickMedia: useMutation({ mutationFn: () => videosService.pickMedia(videoId) }),
		pickMusic: useMutation({ mutationFn: () => videosService.pickMusic(videoId) }),
		generateVoice: useMutation({
			mutationFn: () => videosService.generateVoice(videoId),
			onSettled: refresh,
		}),
		recordVoice: useMutation({
			mutationFn: (input: { sceneId: string; pcm: Float32Array; sampleRate: number }) =>
				videosService.recordVoice(videoId, input.sceneId, input.pcm, input.sampleRate),
			onSettled: refresh,
		}),
		render: useMutation({ mutationFn: () => videosService.render(videoId), onSettled: refresh }),
		cancel: useMutation({ mutationFn: () => videosService.cancel(videoId) }),
		openRender: useMutation({
			mutationFn: (how: "open" | "reveal") => videosService.openRender(videoId, how),
		}),
	};
}

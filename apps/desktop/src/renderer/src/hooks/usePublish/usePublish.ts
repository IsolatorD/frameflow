import type { PlatformId } from "@frameflow/core/catalog";
import type { PostDraft, PublicationView } from "@frameflow/core/publish";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublishOverview } from "../../../../shared/api";
import { publishService } from "../../services/publishService/publishService";

const publishKey = (videoId: string) => ["publish", videoId] as const;

/** Texto de cada red para un video, con las acciones de la pestaña "Publicar". */
export function usePublish(videoId: string, enabled: boolean) {
	const queryClient = useQueryClient();
	const key = publishKey(videoId);
	const overview = useQuery({
		queryKey: key,
		queryFn: () => publishService.overview(videoId),
		enabled,
	});
	/** Actualiza en la caché la publicación de una red. */
	const patch = (view: PublicationView) =>
		queryClient.setQueryData<PublishOverview>(key, (data) =>
			data
				? {
						items: data.items.map((item) =>
							item.platform === view.platform
								? { ...item, post: view.post, publication: view }
								: item,
						),
					}
				: data,
		);
	return {
		overview,
		saveDraft: useMutation({
			mutationFn: ({ platform, post }: { platform: PlatformId; post: PostDraft }) =>
				publishService.saveDraft(videoId, platform, post),
			onSuccess: patch,
		}),
		exportPost: useMutation({
			mutationFn: ({ platform, post }: { platform: PlatformId; post: PostDraft }) =>
				publishService.export(videoId, platform, post),
			onSuccess: patch,
		}),
		improve: useMutation({
			mutationFn: () => publishService.improve(videoId),
			onSuccess: (data) => queryClient.setQueryData(key, data),
		}),
		markPublished: useMutation({
			mutationFn: ({ platform, url }: { platform: PlatformId; url: string | null }) =>
				publishService.markPublished(videoId, platform, url),
			onSuccess: patch,
		}),
	};
}

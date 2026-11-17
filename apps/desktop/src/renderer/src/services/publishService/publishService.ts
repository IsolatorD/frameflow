import type { PlatformId } from "@frameflow/core/catalog";
import type { PostDraft, PublicationView } from "@frameflow/core/publish";
import type { PublishOverview } from "../../../../shared/api";
import { unwrap } from "../../utils/unwrap/unwrap";

// Exportar para redes (fase 1): texto por red, exportación y registro de lo publicado.
export const publishService = {
	overview: (videoId: string): Promise<PublishOverview> =>
		unwrap(window.frameflow.publish.overview(videoId)),
	saveDraft: (videoId: string, platform: PlatformId, post: PostDraft): Promise<PublicationView> =>
		unwrap(window.frameflow.publish.saveDraft(videoId, platform, post)),
	export: (videoId: string, platform: PlatformId, post: PostDraft): Promise<PublicationView> =>
		unwrap(window.frameflow.publish.export(videoId, platform, post)),
	improve: (videoId: string): Promise<PublishOverview> =>
		unwrap(window.frameflow.publish.improve(videoId)),
	markPublished: (videoId: string, platform: PlatformId, url: string | null) =>
		unwrap(window.frameflow.publish.markPublished(videoId, platform, url)),
	openUpload: (platform: PlatformId): Promise<void> =>
		unwrap(window.frameflow.publish.openUpload(platform)),
	reveal: (path: string): Promise<void> => unwrap(window.frameflow.publish.reveal(path)),
};

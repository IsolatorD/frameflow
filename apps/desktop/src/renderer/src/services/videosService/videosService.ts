import type { MusicSettings, Script, VideoSettings } from "@frameflow/core/script";
import type { LlmStatus } from "@frameflow/core/script/ai";
import type { CaptionEdit, TimelineEdit } from "@frameflow/core/script/edit";
import type { CreateVideoInput, JobEvent, VideoDetail, VideoSummary } from "@frameflow/core/video";
import { unwrap } from "../../utils/unwrap/unwrap";

// Videos, IA y progreso de tareas: única puerta de la interfaz hacia el proceso principal.
export const videosService = {
	list: (projectId: string): Promise<VideoSummary[]> =>
		unwrap(window.frameflow.videos.list(projectId)),
	get: (id: string): Promise<VideoDetail | null> => unwrap(window.frameflow.videos.get(id)),
	create: (input: CreateVideoInput): Promise<VideoDetail> =>
		unwrap(window.frameflow.videos.create(input)),
	saveScript: (id: string, script: Script): Promise<VideoDetail> =>
		unwrap(window.frameflow.videos.saveScript(id, script)),
	saveSettings: (id: string, settings: VideoSettings): Promise<VideoDetail> =>
		unwrap(window.frameflow.videos.saveSettings(id, settings)),
	editTimeline: (id: string, edit: TimelineEdit): Promise<VideoDetail> =>
		unwrap(window.frameflow.videos.editTimeline(id, edit)),
	saveCaptions: (id: string, sceneId: string, words: CaptionEdit): Promise<VideoDetail> =>
		unwrap(window.frameflow.videos.saveCaptions(id, sceneId, words)),
	restoreVersion: (id: string, number: number): Promise<VideoDetail> =>
		unwrap(window.frameflow.videos.restoreVersion(id, number)),
	pickMusic: (id: string): Promise<MusicSettings | null> =>
		unwrap(window.frameflow.videos.pickMusic(id)),
	generateVoice: (id: string): Promise<void> => unwrap(window.frameflow.videos.generateVoice(id)),
	render: (id: string): Promise<void> => unwrap(window.frameflow.videos.render(id)),
	cancel: (id: string): Promise<void> => unwrap(window.frameflow.videos.cancel(id)),
	openRender: (id: string, how: "open" | "reveal"): Promise<void> =>
		unwrap(window.frameflow.videos.openRender(id, how)),
	aiStatus: (): Promise<LlmStatus> => unwrap(window.frameflow.ai.status()),
	mediaBaseUrl: (): Promise<string> => unwrap(window.frameflow.app.mediaBaseUrl()),
	onJobEvent: (listener: (event: JobEvent) => void) => window.frameflow.onJobEvent(listener),
};

import { PROVIDERS } from "@frameflow/core/ai/catalog";
import { BUILT_IN_PRESETS } from "@frameflow/core/presets";
import type { BrandKit, CreateProjectInput } from "@frameflow/core/project";
import { postDraftSchema } from "@frameflow/core/publish";
import type { Script, VideoSettings } from "@frameflow/core/script";
import type { CaptionEdit, TimelineEdit } from "@frameflow/core/script/edit";
import type { OverlayOp } from "@frameflow/core/script/overlays";
import type { CreateVideoInput } from "@frameflow/core/video";
import type { ProjectsRepository } from "@frameflow/db/projects";
import type { VideosRepository } from "@frameflow/db/videos";
import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import { z } from "zod";
import { IPC, type IpcResult } from "../../shared/api";
import type { AiSettingsStore } from "../services/aiSettings";
import type { LocalAi } from "../services/localAi/localAi";
import type { Publisher } from "../services/publish";
import type { Updates } from "../services/updates";
import {
	IMAGE_EXTENSIONS,
	MUSIC_EXTENSIONS,
	VIDEO_EXTENSIONS,
	type VideoPipeline,
} from "../services/videoPipeline";

/** Ejecuta un handler y convierte cualquier error en un mensaje legible para la interfaz. */
async function wrap<T>(fn: () => Promise<T> | T): Promise<IpcResult<T>> {
	try {
		return { ok: true, data: await fn() };
	} catch (error) {
		const message =
			error instanceof z.ZodError
				? error.issues.map((issue) => issue.message).join(". ")
				: error instanceof Error
					? error.message
					: String(error);
		console.error("[ipc]", error);
		return { ok: false, error: message };
	}
}

const uuid = (value: unknown) => z.string().uuid().parse(value);

export function registerIpcHandlers(deps: {
	projects: ProjectsRepository;
	videos: VideosRepository;
	pipeline: VideoPipeline;
	ai: AiSettingsStore;
	localAi: LocalAi;
	updates: Updates;
	publisher: Publisher;
	mediaBaseUrl: string;
}): void {
	const { projects, videos, pipeline, ai, localAi, updates, publisher } = deps;

	ipcMain.handle(IPC.appMediaBaseUrl, () => wrap(() => deps.mediaBaseUrl));
	const platform = (value: unknown) =>
		z.enum(["youtube", "instagram", "tiktok", "facebook"]).parse(value);
	ipcMain.handle(IPC.publishOverview, (_e, id: unknown) =>
		wrap(() => publisher.overview(uuid(id))),
	);
	ipcMain.handle(IPC.publishSaveDraft, (_e, id: unknown, p: unknown, post: unknown) =>
		wrap(() => publisher.saveDraft(uuid(id), platform(p), postDraftSchema.parse(post))),
	);
	ipcMain.handle(IPC.publishExport, (_e, id: unknown, p: unknown, post: unknown) =>
		wrap(() => publisher.export(uuid(id), platform(p), postDraftSchema.parse(post))),
	);
	ipcMain.handle(IPC.publishImprove, (_e, id: unknown) =>
		wrap(() => publisher.improveWithAi(uuid(id))),
	);
	ipcMain.handle(IPC.publishMarkPublished, (_e, id: unknown, p: unknown, url: unknown) =>
		wrap(() =>
			publisher.markPublished(uuid(id), platform(p), url === null ? null : z.string().parse(url)),
		),
	);
	ipcMain.handle(IPC.publishOpenUpload, (_e, p: unknown) =>
		wrap(() => publisher.openUpload(platform(p))),
	);
	ipcMain.handle(IPC.publishReveal, (_e, path: unknown) =>
		wrap(() => publisher.reveal(z.string().parse(path))),
	);
	ipcMain.handle(IPC.updatesState, () => wrap(() => updates.state()));
	ipcMain.handle(IPC.updatesCheck, () => wrap(() => updates.check()));
	ipcMain.handle(IPC.updatesDownload, () => wrap(() => updates.download()));
	ipcMain.handle(IPC.updatesInstall, () => wrap(() => updates.install()));
	ipcMain.handle(IPC.presetsList, () => wrap(() => [...BUILT_IN_PRESETS]));
	ipcMain.handle(IPC.projectsList, () => wrap(() => projects.list()));
	ipcMain.handle(IPC.projectsGet, (_e, id: unknown) => wrap(() => projects.get(uuid(id))));
	// La validación real del input ocurre en el repositorio (zod), no se confía en la interfaz.
	ipcMain.handle(IPC.projectsCreate, (_e, input: unknown) =>
		wrap(() => projects.create(input as CreateProjectInput)),
	);
	ipcMain.handle(IPC.projectsUpdateBrandKit, (_e, id: unknown, brandKit: unknown) =>
		wrap(() => projects.updateBrandKit(uuid(id), brandKit as BrandKit)),
	);

	ipcMain.handle(IPC.aiStatus, () => wrap(() => pipeline.aiStatus()));
	ipcMain.handle(IPC.aiSettings, () => wrap(() => ai.view()));
	ipcMain.handle(IPC.aiSaveSettings, (_e, settings: unknown) =>
		wrap(() => ai.saveSettings(settings)),
	);
	ipcMain.handle(IPC.aiSetKey, (_e, provider: unknown, key: unknown) =>
		wrap(() => ai.setKey(provider, key)),
	);
	ipcMain.handle(IPC.aiTest, (_e, provider: unknown, model: unknown) =>
		wrap(() => ai.test(provider, model)),
	);
	ipcMain.handle(IPC.aiPrepareLocal, (_e, model: unknown) =>
		wrap(() => {
			const id = z.string().trim().min(1).parse(model);
			const known = PROVIDERS.ollama.models.find((m) => m.id === id);
			return localAi.prepare(id, known?.sizeGb ?? null);
		}),
	);
	ipcMain.handle(IPC.aiCancelLocal, () => wrap(() => localAi.cancel()));
	ipcMain.handle(IPC.aiDismissLocal, () => wrap(() => localAi.dismiss()));
	ipcMain.handle(IPC.videosList, (_e, projectId: unknown) =>
		wrap(() => videos.list(uuid(projectId))),
	);
	ipcMain.handle(IPC.videosGet, (_e, id: unknown) => wrap(() => videos.get(uuid(id))));
	ipcMain.handle(IPC.videosCreate, (_e, input: unknown) =>
		wrap(() => pipeline.create(input as CreateVideoInput)),
	);
	ipcMain.handle(IPC.videosSaveScript, (_e, id: unknown, script: unknown) =>
		wrap(() => pipeline.saveScript(uuid(id), script as Script)),
	);
	ipcMain.handle(IPC.videosSaveSettings, (_e, id: unknown, settings: unknown) =>
		wrap(() => pipeline.saveSettings(uuid(id), settings as VideoSettings)),
	);
	ipcMain.handle(IPC.videosEditTimeline, (_e, id: unknown, edit: unknown) =>
		wrap(() => pipeline.editTimeline(uuid(id), edit as TimelineEdit)),
	);
	ipcMain.handle(IPC.videosSaveCaptions, (_e, id: unknown, sceneId: unknown, words: unknown) =>
		wrap(() =>
			pipeline.saveCaptions(uuid(id), z.string().min(1).parse(sceneId), words as CaptionEdit),
		),
	);
	ipcMain.handle(IPC.videosRestoreVersion, (_e, id: unknown, number: unknown) =>
		wrap(() => pipeline.restoreVersion(uuid(id), z.number().int().positive().parse(number))),
	);
	ipcMain.handle(IPC.videosEditOverlays, (_e, id: unknown, op: unknown) =>
		wrap(() => pipeline.editOverlays(uuid(id), op as OverlayOp)),
	);
	ipcMain.handle(IPC.videosPickMedia, (event, id: unknown) =>
		wrap(async () => {
			const videoId = uuid(id);
			const window = BrowserWindow.fromWebContents(event.sender);
			const options: Electron.OpenDialogOptions = {
				title: "Elige una imagen o un video",
				properties: ["openFile"],
				filters: [
					{ name: "Imágenes y videos", extensions: [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS] },
				],
			};
			const testFile = process.env.FRAMEFLOW_TEST_MEDIA; // ver FRAMEFLOW_TEST_MUSIC
			const result = testFile
				? { canceled: false, filePaths: [testFile] }
				: window
					? await dialog.showOpenDialog(window, options)
					: await dialog.showOpenDialog(options);
			const file = result.filePaths[0];
			return result.canceled || !file ? null : pipeline.importMedia(videoId, file);
		}),
	);
	ipcMain.handle(IPC.videosPickMusic, (event, id: unknown) =>
		wrap(async () => {
			const videoId = uuid(id);
			const window = BrowserWindow.fromWebContents(event.sender);
			const options: Electron.OpenDialogOptions = {
				title: "Elige la música de fondo",
				properties: ["openFile"],
				filters: [{ name: "Audio", extensions: MUSIC_EXTENSIONS }],
			};
			// En las pruebas automáticas el diálogo nativo no se puede pulsar: se pasa el archivo por entorno.
			const testFile = process.env.FRAMEFLOW_TEST_MUSIC;
			const result = testFile
				? { canceled: false, filePaths: [testFile] }
				: window
					? await dialog.showOpenDialog(window, options)
					: await dialog.showOpenDialog(options);
			const file = result.filePaths[0];
			return result.canceled || !file ? null : pipeline.importMusic(videoId, file);
		}),
	);
	ipcMain.handle(IPC.videosGenerateVoice, (_e, id: unknown) =>
		wrap(() => pipeline.generateVoice(uuid(id))),
	);
	ipcMain.handle(
		IPC.videosRecordVoice,
		(_e, id: unknown, sceneId: unknown, pcm: unknown, sampleRate: unknown) =>
			wrap(() => {
				if (!(pcm instanceof Float32Array)) throw new Error("Grabación no válida");
				const rate = z.number().int().min(8000).max(192_000).parse(sampleRate);
				if (pcm.length > rate * 180)
					throw new Error("La grabación de una escena admite hasta 3 minutos.");
				return pipeline.recordVoice(uuid(id), z.string().min(1).parse(sceneId), pcm, rate);
			}),
	);
	ipcMain.handle(IPC.videosReviewScript, (_e, id: unknown) =>
		wrap(() => pipeline.reviewScript(uuid(id))),
	);
	ipcMain.handle(IPC.videosCancelReview, (_e, id: unknown) =>
		wrap(() => pipeline.cancelReview(uuid(id))),
	);
	ipcMain.handle(IPC.videosRender, (_e, id: unknown) => wrap(() => pipeline.render(uuid(id))));
	ipcMain.handle(IPC.videosCancel, (_e, id: unknown) => wrap(() => pipeline.cancel(uuid(id))));
	ipcMain.handle(IPC.videosOpenRender, (_e, id: unknown, how: unknown) =>
		wrap(async () => {
			const video = await videos.get(uuid(id));
			const path = video?.render?.status === "done" ? video.render.path : null;
			if (!path) throw new Error("Este video aún no tiene un MP4");
			if (how === "reveal") shell.showItemInFolder(path);
			else {
				const failure = await shell.openPath(path);
				if (failure) throw new Error(failure);
			}
		}),
	);
}

import type { LocalAiState } from "@frameflow/core/ai/localRuntime";
import type { JobEvent } from "@frameflow/core/video";
import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import { type FrameflowApi, IPC } from "../shared/api";
import type { UpdateState } from "../shared/updates";

// Única superficie que ve la interfaz. Sin acceso a Node ni a ipcRenderer directo.
const api: FrameflowApi = {
	app: {
		mediaBaseUrl: () => ipcRenderer.invoke(IPC.appMediaBaseUrl),
	},
	updates: {
		state: () => ipcRenderer.invoke(IPC.updatesState),
		check: () => ipcRenderer.invoke(IPC.updatesCheck),
		download: () => ipcRenderer.invoke(IPC.updatesDownload),
		install: () => ipcRenderer.invoke(IPC.updatesInstall),
		onEvent: (listener) => {
			const handler = (_event: IpcRendererEvent, payload: UpdateState) => listener(payload);
			ipcRenderer.on(IPC.updatesEvent, handler);
			return () => ipcRenderer.removeListener(IPC.updatesEvent, handler);
		},
	},
	presets: {
		list: () => ipcRenderer.invoke(IPC.presetsList),
	},
	projects: {
		list: () => ipcRenderer.invoke(IPC.projectsList),
		get: (id) => ipcRenderer.invoke(IPC.projectsGet, id),
		create: (input) => ipcRenderer.invoke(IPC.projectsCreate, input),
		updateBrandKit: (id, brandKit) => ipcRenderer.invoke(IPC.projectsUpdateBrandKit, id, brandKit),
	},
	ai: {
		status: () => ipcRenderer.invoke(IPC.aiStatus),
		settings: () => ipcRenderer.invoke(IPC.aiSettings),
		saveSettings: (settings) => ipcRenderer.invoke(IPC.aiSaveSettings, settings),
		setKey: (provider, key) => ipcRenderer.invoke(IPC.aiSetKey, provider, key),
		test: (provider, model) => ipcRenderer.invoke(IPC.aiTest, provider, model),
		prepareLocal: (model) => ipcRenderer.invoke(IPC.aiPrepareLocal, model),
		cancelLocal: () => ipcRenderer.invoke(IPC.aiCancelLocal),
		dismissLocal: () => ipcRenderer.invoke(IPC.aiDismissLocal),
		onLocalEvent: (listener) => {
			const handler = (_event: IpcRendererEvent, payload: LocalAiState) => listener(payload);
			ipcRenderer.on(IPC.aiLocalEvent, handler);
			return () => ipcRenderer.removeListener(IPC.aiLocalEvent, handler);
		},
	},
	videos: {
		list: (projectId) => ipcRenderer.invoke(IPC.videosList, projectId),
		get: (id) => ipcRenderer.invoke(IPC.videosGet, id),
		create: (input) => ipcRenderer.invoke(IPC.videosCreate, input),
		saveScript: (id, script) => ipcRenderer.invoke(IPC.videosSaveScript, id, script),
		saveSettings: (id, settings) => ipcRenderer.invoke(IPC.videosSaveSettings, id, settings),
		editTimeline: (id, edit) => ipcRenderer.invoke(IPC.videosEditTimeline, id, edit),
		saveCaptions: (id, sceneId, words) =>
			ipcRenderer.invoke(IPC.videosSaveCaptions, id, sceneId, words),
		restoreVersion: (id, number) => ipcRenderer.invoke(IPC.videosRestoreVersion, id, number),
		editOverlays: (id, op) => ipcRenderer.invoke(IPC.videosEditOverlays, id, op),
		pickMedia: (id) => ipcRenderer.invoke(IPC.videosPickMedia, id),
		pickMusic: (id) => ipcRenderer.invoke(IPC.videosPickMusic, id),
		generateVoice: (id) => ipcRenderer.invoke(IPC.videosGenerateVoice, id),
		render: (id) => ipcRenderer.invoke(IPC.videosRender, id),
		cancel: (id) => ipcRenderer.invoke(IPC.videosCancel, id),
		openRender: (id, how) => ipcRenderer.invoke(IPC.videosOpenRender, id, how),
	},
	publish: {
		overview: (videoId) => ipcRenderer.invoke(IPC.publishOverview, videoId),
		saveDraft: (videoId, platform, post) =>
			ipcRenderer.invoke(IPC.publishSaveDraft, videoId, platform, post),
		export: (videoId, platform, post) =>
			ipcRenderer.invoke(IPC.publishExport, videoId, platform, post),
		improve: (videoId) => ipcRenderer.invoke(IPC.publishImprove, videoId),
		markPublished: (videoId, platform, url) =>
			ipcRenderer.invoke(IPC.publishMarkPublished, videoId, platform, url),
		openUpload: (platform) => ipcRenderer.invoke(IPC.publishOpenUpload, platform),
		reveal: (path) => ipcRenderer.invoke(IPC.publishReveal, path),
	},
	onJobEvent: (listener) => {
		const handler = (_event: IpcRendererEvent, payload: JobEvent) => listener(payload);
		ipcRenderer.on(IPC.jobEvent, handler);
		return () => ipcRenderer.removeListener(IPC.jobEvent, handler);
	},
};

contextBridge.exposeInMainWorld("frameflow", api);

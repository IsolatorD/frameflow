import type { JobEvent } from "@frameflow/core/video";
import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import { type FrameflowApi, IPC } from "../shared/api";

// Única superficie que ve la interfaz. Sin acceso a Node ni a ipcRenderer directo.
const api: FrameflowApi = {
	app: {
		mediaBaseUrl: () => ipcRenderer.invoke(IPC.appMediaBaseUrl),
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
	},
	videos: {
		list: (projectId) => ipcRenderer.invoke(IPC.videosList, projectId),
		get: (id) => ipcRenderer.invoke(IPC.videosGet, id),
		create: (input) => ipcRenderer.invoke(IPC.videosCreate, input),
		saveScript: (id, script) => ipcRenderer.invoke(IPC.videosSaveScript, id, script),
		saveSettings: (id, settings) => ipcRenderer.invoke(IPC.videosSaveSettings, id, settings),
		pickMusic: (id) => ipcRenderer.invoke(IPC.videosPickMusic, id),
		generateVoice: (id) => ipcRenderer.invoke(IPC.videosGenerateVoice, id),
		render: (id) => ipcRenderer.invoke(IPC.videosRender, id),
		cancel: (id) => ipcRenderer.invoke(IPC.videosCancel, id),
		openRender: (id, how) => ipcRenderer.invoke(IPC.videosOpenRender, id, how),
	},
	onJobEvent: (listener) => {
		const handler = (_event: IpcRendererEvent, payload: JobEvent) => listener(payload);
		ipcRenderer.on(IPC.jobEvent, handler);
		return () => ipcRenderer.removeListener(IPC.jobEvent, handler);
	},
};

contextBridge.exposeInMainWorld("frameflow", api);

import { contextBridge, ipcRenderer } from "electron";
import { type FrameflowApi, IPC } from "../shared/api";

// Única superficie que ve la interfaz. Sin acceso a Node ni a ipcRenderer directo.
const api: FrameflowApi = {
	presets: {
		list: () => ipcRenderer.invoke(IPC.presetsList),
	},
	projects: {
		list: () => ipcRenderer.invoke(IPC.projectsList),
		get: (id) => ipcRenderer.invoke(IPC.projectsGet, id),
		create: (input) => ipcRenderer.invoke(IPC.projectsCreate, input),
		updateBrandKit: (id, brandKit) => ipcRenderer.invoke(IPC.projectsUpdateBrandKit, id, brandKit),
	},
};

contextBridge.exposeInMainWorld("frameflow", api);

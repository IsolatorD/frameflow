import { BUILT_IN_PRESETS } from "@frameflow/core/presets";
import type { BrandKit, CreateProjectInput } from "@frameflow/core/project";
import type { Script } from "@frameflow/core/script";
import type { CreateVideoInput } from "@frameflow/core/video";
import type { ProjectsRepository } from "@frameflow/db/projects";
import type { VideosRepository } from "@frameflow/db/videos";
import { ipcMain, shell } from "electron";
import { z } from "zod";
import { IPC, type IpcResult } from "../../shared/api";
import type { VideoPipeline } from "../services/videoPipeline";

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
	mediaBaseUrl: string;
}): void {
	const { projects, videos, pipeline } = deps;

	ipcMain.handle(IPC.appMediaBaseUrl, () => wrap(() => deps.mediaBaseUrl));
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
	ipcMain.handle(IPC.videosGenerateVoice, (_e, id: unknown) =>
		wrap(() => pipeline.generateVoice(uuid(id))),
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

import { BUILT_IN_PRESETS } from "@frameflow/core/presets";
import type { BrandKit, CreateProjectInput } from "@frameflow/core/project";
import type { Database } from "@frameflow/db/client";
import { createProjectsRepository } from "@frameflow/db/projects";
import { ipcMain } from "electron";
import { z } from "zod";
import { IPC, type IpcResult } from "../../shared/api";

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

export function registerIpcHandlers(db: Database): void {
	const projects = createProjectsRepository(db);

	ipcMain.handle(IPC.presetsList, () => wrap(() => [...BUILT_IN_PRESETS]));
	ipcMain.handle(IPC.projectsList, () => wrap(() => projects.list()));
	ipcMain.handle(IPC.projectsGet, (_event, id: unknown) =>
		wrap(() => projects.get(z.string().uuid().parse(id))),
	);
	// La validación real del input ocurre en el repositorio (zod), no se confía en la interfaz.
	ipcMain.handle(IPC.projectsCreate, (_event, input: unknown) =>
		wrap(() => projects.create(input as CreateProjectInput)),
	);
	ipcMain.handle(IPC.projectsUpdateBrandKit, (_event, id: unknown, brandKit: unknown) =>
		wrap(() => projects.updateBrandKit(z.string().uuid().parse(id), brandKit as BrandKit)),
	);
}

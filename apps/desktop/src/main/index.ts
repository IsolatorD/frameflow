import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { OllamaProvider } from "@frameflow/core/script/ai";
import { openDatabase } from "@frameflow/db/client";
import { createProjectsRepository } from "@frameflow/db/projects";
import { createVideosRepository } from "@frameflow/db/videos";
import { app, BrowserWindow, shell } from "electron";
import { IPC } from "../shared/api";
import { registerIpcHandlers } from "./ipc/registerIpcHandlers";
import { startMediaServer } from "./services/mediaServer";
import { createVideoPipeline } from "./services/videoPipeline";

// Carpeta de datos del usuario (BD + proyectos). FRAMEFLOW_HOME permite aislarla (tests, pruebas).
const dataDir = process.env.FRAMEFLOW_HOME ?? join(homedir(), "Frameflow");
// En desarrollo la app vive en apps/desktop y usa recursos de otros paquetes del monorepo.
// TODO(empaquetado): copiarlos como extraResources y resolverlos desde process.resourcesPath.
const repoRoot = join(app.getAppPath(), "../..");
const migrationsFolder = join(repoRoot, "packages/db/drizzle");
const ttsDir = join(repoRoot, "packages/tts");
const rendererEntry = join(repoRoot, "packages/renderer-remotion/src/index.ts");
// Modelo local para el modo automático (configurable).
const llmModel = process.env.FRAMEFLOW_MODEL ?? "hf.co/unsloth/Qwen3-8B-GGUF:Q4_K_M";

function createWindow(): void {
	const window = new BrowserWindow({
		width: 1280,
		height: 820,
		minWidth: 960,
		minHeight: 640,
		show: false,
		backgroundColor: "#0f0f12",
		titleBarStyle: "hiddenInset",
		webPreferences: {
			preload: join(import.meta.dirname, "../preload/index.mjs"),
			contextIsolation: true,
			nodeIntegration: false,
			// El preload es ESM (.mjs), que Electron solo admite sin sandbox.
			// La interfaz sigue aislada: solo ve lo que expone contextBridge.
			sandbox: false,
		},
	});

	window.on("ready-to-show", () => window.show());
	// Enlaces externos al navegador del sistema, nunca dentro de la app.
	window.webContents.setWindowOpenHandler(({ url }) => {
		void shell.openExternal(url);
		return { action: "deny" };
	});

	if (process.env.ELECTRON_RENDERER_URL) {
		void window.loadURL(process.env.ELECTRON_RENDERER_URL);
	} else {
		void window.loadFile(join(import.meta.dirname, "../renderer/index.html"));
	}
}

app.whenReady().then(async () => {
	mkdirSync(dataDir, { recursive: true });
	const db = await openDatabase(`file:${join(dataDir, "frameflow.db")}`, migrationsFolder);
	const projects = createProjectsRepository(db);
	const videos = createVideosRepository(db);
	await videos.recoverInterrupted();
	const media = await startMediaServer(dataDir);
	const pipeline = createVideoPipeline({
		projects,
		videos,
		llm: new OllamaProvider(llmModel, process.env.OLLAMA_URL),
		dataDir,
		ttsDir,
		rendererEntry,
		mediaBaseUrl: media.baseUrl,
		emit: (event) => {
			for (const window of BrowserWindow.getAllWindows())
				window.webContents.send(IPC.jobEvent, event);
		},
	});
	registerIpcHandlers({ projects, videos, pipeline, mediaBaseUrl: media.baseUrl });
	createWindow();

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});

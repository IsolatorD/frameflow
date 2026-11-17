import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseFromNewerVersionError, openDatabase } from "@frameflow/db/client";
import { createProjectsRepository } from "@frameflow/db/projects";
import { createPublicationsRepository } from "@frameflow/db/publications";
import { createVideosRepository } from "@frameflow/db/videos";
import { app, BrowserWindow, dialog, shell } from "electron";
import { IPC } from "../shared/api";
import { registerIpcHandlers } from "./ipc/registerIpcHandlers";
import { createAiSettingsStore } from "./services/aiSettings";
import { createLocalAi } from "./services/localAi/localAi";
import { startMediaServer } from "./services/mediaServer";
import { createPublisher } from "./services/publish";
import { createUpdates } from "./services/updates";
import { createVideoPipeline } from "./services/videoPipeline";
import { createVoiceEngine } from "./services/voice/kokoro";

// Carpeta de datos del usuario (BD + proyectos). FRAMEFLOW_HOME permite aislarla (tests, pruebas).
const dataDir = process.env.FRAMEFLOW_HOME ?? join(homedir(), "Frameflow");
// En desarrollo la app vive en apps/desktop y usa recursos de otros paquetes del monorepo; instalada,
// electron-builder los copia a resources/ (ver electron-builder.yml).
const repoRoot = join(app.getAppPath(), "../..");
const migrationsFolder = app.isPackaged
	? join(process.resourcesPath, "drizzle")
	: join(repoRoot, "packages/db/drizzle");
const remotion = app.isPackaged
	? { serveUrl: join(process.resourcesPath, "remotion-bundle") }
	: { entryPoint: join(repoRoot, "packages/renderer-remotion/src/index.ts") };
// Archivos que se ejecutan como procesos aparte: instalada, fuera del .asar (app.asar.unpacked).
const unpacked = (path: string) => path.replace(/app\.asar([\\/])/, "app.asar.unpacked$1");
// Icono de la app (lo genera `pnpm icons` desde brand/). Empaquetada, lo pone build/icon.icns.
const appIcon = join(app.getAppPath(), "resources/icon.png");

/**
 * Remotion descarga su Chrome sin interfaz junto al package.json más cercano al directorio de
 * trabajo, que en la app instalada suele ser "/" (sin permiso de escritura): se lleva a los datos.
 */
function moveToWritableWorkingDir() {
	const dir = join(dataDir, "runtime", "remotion");
	mkdirSync(dir, { recursive: true });
	const manifest = join(dir, "package.json");
	if (!existsSync(manifest)) writeFileSync(manifest, '{ "private": true }\n');
	process.chdir(dir);
}

function createWindow(): void {
	const window = new BrowserWindow({
		width: 1280,
		height: 820,
		minWidth: 960,
		minHeight: 640,
		show: false,
		backgroundColor: "#0f0f12",
		icon: appIcon, // Windows/Linux; en macOS manda el icono del Dock
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
	// En desarrollo macOS mostraría el icono de Electron: se pone el de Frameflow.
	if (process.platform === "darwin" && !app.isPackaged) app.dock?.setIcon(appIcon);
	mkdirSync(dataDir, { recursive: true });
	if (app.isPackaged) moveToWritableWorkingDir();
	// Antes de migrar se copia la BD a <datos>/backups; si es de una versión más nueva, no se toca.
	let db: Awaited<ReturnType<typeof openDatabase>>;
	try {
		db = await openDatabase(`file:${join(dataDir, "frameflow.db")}`, migrationsFolder, {
			backupDir: join(dataDir, "backups"),
			onBackup: (path) => console.info(`[db] copia de seguridad antes de migrar: ${path}`),
		});
	} catch (error) {
		const message =
			error instanceof DatabaseFromNewerVersionError
				? error.message
				: `No se pudo abrir la base de datos: ${error instanceof Error ? error.message : String(error)}`;
		dialog.showErrorBox("Frameflow no puede abrir tus datos", `${message}\n\nCarpeta: ${dataDir}`);
		app.quit();
		return;
	}
	const projects = createProjectsRepository(db);
	const videos = createVideosRepository(db);
	await videos.recoverInterrupted();
	const media = await startMediaServer(dataDir);
	// IA local: usa el Ollama del usuario si lo hay; si no, el que descarga la app (Ajustes).
	// OLLAMA_URL fija uno concreto; FRAMEFLOW_IGNORE_SYSTEM_OLLAMA=1 prueba la descarga aunque haya otro.
	const localAi = createLocalAi({
		dataDir,
		overrideUrl: process.env.OLLAMA_URL,
		ignoreSystem: process.env.FRAMEFLOW_IGNORE_SYSTEM_OLLAMA === "1",
		emit: (state) => {
			for (const window of BrowserWindow.getAllWindows())
				window.webContents.send(IPC.aiLocalEvent, state);
		},
	});
	void localAi.detect(); // arranca el Ollama de la app en segundo plano si ya está descargado
	app.on("will-quit", () => localAi.stop());
	// IA elegida en Ajustes. FRAMEFLOW_MODEL solo cambia el modelo local por defecto (pruebas).
	const ai = createAiSettingsStore({
		dataDir,
		defaultOllamaModel: process.env.FRAMEFLOW_MODEL,
		localAi,
	});
	const pipeline = createVideoPipeline({
		projects,
		videos,
		llm: () => ai.current(),
		dataDir,
		voice: createVoiceEngine({
			dataDir,
			espeakScript: unpacked(join(import.meta.dirname, "espeak-process.js")),
		}),
		remotion,
		mediaBaseUrl: media.baseUrl,
		emit: (event) => {
			for (const window of BrowserWindow.getAllWindows())
				window.webContents.send(IPC.jobEvent, event);
		},
	});
	const updates = createUpdates({
		isBusy: () => pipeline.anyBusy(),
		emit: (state) => {
			for (const window of BrowserWindow.getAllWindows())
				window.webContents.send(IPC.updatesEvent, state);
		},
	});
	const publisher = createPublisher({
		dataDir,
		projects,
		videos,
		publications: createPublicationsRepository(db),
		remotion,
		mediaBaseUrl: media.baseUrl,
		llm: () => ai.current(),
	});
	registerIpcHandlers({
		publisher,
		projects,
		videos,
		pipeline,
		ai,
		localAi,
		updates,
		mediaBaseUrl: media.baseUrl,
	});
	updates.start();
	createWindow();

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});

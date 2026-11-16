import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "@frameflow/db/client";
import { app, BrowserWindow, shell } from "electron";
import { registerIpcHandlers } from "./ipc/registerIpcHandlers";

// Carpeta de datos del usuario (BD + proyectos). FRAMEFLOW_HOME permite aislarla (tests, pruebas).
const dataDir = process.env.FRAMEFLOW_HOME ?? join(homedir(), "Frameflow");
// En desarrollo la app vive en apps/desktop; las migraciones, en packages/db/drizzle.
// TODO(empaquetado): copiarlas como extraResources y resolverlas desde process.resourcesPath.
const migrationsFolder = join(app.getAppPath(), "../../packages/db/drizzle");

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
	registerIpcHandlers(db);
	createWindow();

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});

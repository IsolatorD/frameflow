import { app, shell } from "electron";
import updater from "electron-updater";
import type { UpdateState } from "../../shared/updates";

// Actualizaciones con electron-updater desde las releases de GitHub (las publica la CI con
// electron-builder). Nunca descarga sin que el usuario lo pida y no reinicia con trabajos en marcha.
// FRAMEFLOW_UPDATE_URL apunta a otro servidor (pruebas); FRAMEFLOW_UPDATES=0 las desactiva.

const { autoUpdater } = updater;
const RELEASES = "https://github.com/IsolatorD/frameflow/releases";
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

export type Updates = ReturnType<typeof createUpdates>;

export function createUpdates(opts: { emit: (state: UpdateState) => void; isBusy: () => boolean }) {
	const testUrl = process.env.FRAMEFLOW_UPDATE_URL;
	const enabled = process.env.FRAMEFLOW_UPDATES !== "0" && (app.isPackaged || Boolean(testUrl));
	// macOS sin firma no puede reemplazar la app: solo se avisa.
	const canInstall = process.platform !== "darwin";
	let state: UpdateState = {
		current: app.getVersion(),
		status: enabled ? "idle" : "disabled",
		canInstall,
	};
	const set = (patch: Partial<UpdateState>) => {
		state = { ...state, ...patch };
		opts.emit(get());
	};
	const get = (): UpdateState => ({ ...state, busy: opts.isBusy() });

	if (enabled) {
		autoUpdater.autoDownload = false;
		autoUpdater.autoInstallOnAppQuit = canInstall;
		autoUpdater.logger = null;
		if (testUrl) {
			autoUpdater.forceDevUpdateConfig = true;
			autoUpdater.setFeedURL({ provider: "generic", url: testUrl });
		}
		autoUpdater.on("checking-for-update", () => set({ status: "checking", error: undefined }));
		autoUpdater.on("update-not-available", () => set({ status: "none" }));
		autoUpdater.on("update-available", (info) =>
			set({
				status: "available",
				version: info.version,
				notes: releaseNotes(info.releaseNotes),
				releaseUrl: `${RELEASES}/tag/v${info.version}`,
			}),
		);
		autoUpdater.on("download-progress", (p) =>
			set({ status: "downloading", progress: p.percent / 100 }),
		);
		autoUpdater.on("update-downloaded", () => set({ status: "ready", progress: 1 }));
		autoUpdater.on("error", (error) =>
			set({
				status: "error",
				error: friendly(error instanceof Error ? error.message : String(error)),
			}),
		);
	}

	const check = async () => {
		if (!enabled || state.status === "downloading" || state.status === "ready") return get();
		try {
			await autoUpdater.checkForUpdates();
		} catch {
			// el evento "error" ya actualizó el estado
		}
		return get();
	};

	return {
		state: get,
		check,
		/** Empieza a buscar al arrancar (con un pequeño retraso) y luego cada 6 horas. */
		start() {
			if (!enabled) return;
			setTimeout(() => void check(), testUrl ? 1000 : 15_000);
			setInterval(() => void check(), CHECK_EVERY_MS).unref();
		},
		async download() {
			if (state.status !== "available") return get();
			if (!canInstall) {
				await shell.openExternal(state.releaseUrl ?? RELEASES);
				return get();
			}
			set({ status: "downloading", progress: 0 });
			try {
				await autoUpdater.downloadUpdate();
			} catch {
				// el evento "error" ya actualizó el estado
			}
			return get();
		},
		install() {
			if (state.status !== "ready") return get();
			if (opts.isBusy())
				throw new Error("Hay un video generándose: espera a que termine para reiniciar.");
			setImmediate(() => autoUpdater.quitAndInstall());
			return get();
		},
	};
}

function releaseNotes(notes: unknown): string | undefined {
	if (typeof notes === "string") return stripHtml(notes);
	if (Array.isArray(notes))
		return notes
			.map((n) => (typeof n?.note === "string" ? stripHtml(n.note) : ""))
			.filter(Boolean)
			.join("\n\n");
	return undefined;
}

const stripHtml = (html: string) =>
	html
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(p|li|h\d)>/gi, "\n")
		.replace(/<li>/gi, "• ")
		.replace(/<[^>]+>/g, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

const friendly = (message: string) =>
	/ENOTFOUND|ETIMEDOUT|ECONNRESET|net::|getaddrinfo/i.test(message)
		? "No se pudo comprobar si hay actualizaciones (sin conexión)."
		: `No se pudo actualizar: ${message.split("\n")[0]}`;

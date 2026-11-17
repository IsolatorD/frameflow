// Contrato entre el proceso principal (BD, archivos) y la interfaz (React).
// La interfaz nunca toca la BD: pide cosas por IPC a través de `window.frameflow`.
import type { AiSettings, AiSettingsView, CloudProviderId } from "@frameflow/core/ai/catalog";
import type { LocalAiState } from "@frameflow/core/ai/localRuntime";
import type { NichePreset } from "@frameflow/core/presets";
import type {
	BrandKit,
	CreateProjectInput,
	ProjectSummary,
	ProjectWithBrand,
} from "@frameflow/core/project";
import type { MusicSettings, Script, VideoSettings } from "@frameflow/core/script";
import type { LlmStatus } from "@frameflow/core/script/ai";
import type { CaptionEdit, TimelineEdit } from "@frameflow/core/script/edit";
import type { NewOverlay, OverlayOp } from "@frameflow/core/script/overlays";
import type { CreateVideoInput, JobEvent, VideoDetail, VideoSummary } from "@frameflow/core/video";

/** Resultado de una llamada IPC: errores como dato, no como excepción (mensajes limpios). */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type FrameflowApi = {
	app: {
		/** URL base del servidor local de medios (voces, renders…) para la vista previa. */
		mediaBaseUrl(): Promise<IpcResult<string>>;
	};
	presets: {
		list(): Promise<IpcResult<NichePreset[]>>;
	};
	projects: {
		list(): Promise<IpcResult<ProjectSummary[]>>;
		get(id: string): Promise<IpcResult<ProjectWithBrand | null>>;
		create(input: CreateProjectInput): Promise<IpcResult<ProjectWithBrand>>;
		updateBrandKit(id: string, brandKit: BrandKit): Promise<IpcResult<ProjectWithBrand>>;
	};
	ai: {
		/** ¿Se puede escribir un guion ahora con la IA elegida? */
		status(): Promise<IpcResult<LlmStatus>>;
		/** Ajustes, estado de las claves (nunca las claves) y datos del equipo. */
		settings(): Promise<IpcResult<AiSettingsView>>;
		saveSettings(settings: AiSettings): Promise<IpcResult<AiSettings>>;
		/** Guarda la clave cifrada; null la borra. */
		setKey(provider: CloudProviderId, key: string | null): Promise<IpcResult<void>>;
		/** Prueba clave y modelo sin gastar tokens. */
		test(provider: AiSettings["provider"], model: string): Promise<IpcResult<LlmStatus>>;
		/** Descarga Ollama (si falta) y el modelo; el progreso llega por onLocalEvent. */
		prepareLocal(model: string): Promise<IpcResult<LocalAiState>>;
		cancelLocal(): Promise<IpcResult<void>>;
		/** Oculta el aviso de una preparación terminada o fallida. */
		dismissLocal(): Promise<IpcResult<void>>;
		onLocalEvent(listener: (state: LocalAiState) => void): () => void;
	};
	videos: {
		list(projectId: string): Promise<IpcResult<VideoSummary[]>>;
		get(id: string): Promise<IpcResult<VideoDetail | null>>;
		create(input: CreateVideoInput): Promise<IpcResult<VideoDetail>>;
		saveScript(id: string, script: Script): Promise<IpcResult<VideoDetail>>;
		saveSettings(id: string, settings: VideoSettings): Promise<IpcResult<VideoDetail>>;
		editTimeline(id: string, edit: TimelineEdit): Promise<IpcResult<VideoDetail>>;
		saveCaptions(id: string, sceneId: string, words: CaptionEdit): Promise<IpcResult<VideoDetail>>;
		restoreVersion(id: string, number: number): Promise<IpcResult<VideoDetail>>;
		editOverlays(
			id: string,
			op: OverlayOp,
		): Promise<IpcResult<{ video: VideoDetail; clipId: string | null }>>;
		/** Abre el selector de archivos y copia la imagen o el video al proyecto; null si se cancela. */
		pickMedia(id: string): Promise<IpcResult<Exclude<NewOverlay, { type: "text" }> | null>>;
		/** Abre el selector de archivos y copia la música al proyecto; null si se cancela. */
		pickMusic(id: string): Promise<IpcResult<MusicSettings | null>>;
		generateVoice(id: string): Promise<IpcResult<void>>;
		render(id: string): Promise<IpcResult<void>>;
		cancel(id: string): Promise<IpcResult<void>>;
		/** Abre el último MP4 en el reproductor del sistema, o lo muestra en el Finder. */
		openRender(id: string, how: "open" | "reveal"): Promise<IpcResult<void>>;
	};
	/** Suscripción al progreso de tareas largas; devuelve la función para darse de baja. */
	onJobEvent(listener: (event: JobEvent) => void): () => void;
};

export const IPC = {
	appMediaBaseUrl: "app:media-base-url",
	presetsList: "presets:list",
	projectsList: "projects:list",
	projectsGet: "projects:get",
	projectsCreate: "projects:create",
	projectsUpdateBrandKit: "projects:update-brand-kit",
	aiStatus: "ai:status",
	aiSettings: "ai:settings",
	aiSaveSettings: "ai:save-settings",
	aiSetKey: "ai:set-key",
	aiTest: "ai:test",
	aiPrepareLocal: "ai:prepare-local",
	aiCancelLocal: "ai:cancel-local",
	aiDismissLocal: "ai:dismiss-local",
	aiLocalEvent: "ai:local-event",
	videosList: "videos:list",
	videosGet: "videos:get",
	videosCreate: "videos:create",
	videosSaveScript: "videos:save-script",
	videosSaveSettings: "videos:save-settings",
	videosEditTimeline: "videos:edit-timeline",
	videosSaveCaptions: "videos:save-captions",
	videosRestoreVersion: "videos:restore-version",
	videosEditOverlays: "videos:edit-overlays",
	videosPickMedia: "videos:pick-media",
	videosPickMusic: "videos:pick-music",
	videosGenerateVoice: "videos:generate-voice",
	videosRender: "videos:render",
	videosCancel: "videos:cancel",
	videosOpenRender: "videos:open-render",
	jobEvent: "jobs:event",
} as const;

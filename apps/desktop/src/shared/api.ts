// Contrato entre el proceso principal (BD, archivos) y la interfaz (React).
// La interfaz nunca toca la BD: pide cosas por IPC a través de `window.frameflow`.
import type { AiSettings, AiSettingsView, CloudProviderId } from "@frameflow/core/ai/catalog";
import type { LocalAiState } from "@frameflow/core/ai/localRuntime";
import type { PlatformId } from "@frameflow/core/catalog";
import type { NichePreset } from "@frameflow/core/presets";
import type {
	BrandKit,
	CreateProjectInput,
	ProjectSummary,
	ProjectWithBrand,
} from "@frameflow/core/project";
import type { PostDraft, PublicationView } from "@frameflow/core/publish";
import type { MusicSettings, Script, VideoSettings } from "@frameflow/core/script";
import type { LlmStatus } from "@frameflow/core/script/ai";
import type { CaptionEdit, TimelineEdit } from "@frameflow/core/script/edit";
import type { NewOverlay, OverlayOp } from "@frameflow/core/script/overlays";
import type { ScriptReview } from "@frameflow/core/script/review";
import type { CreateVideoInput, JobEvent, VideoDetail, VideoSummary } from "@frameflow/core/video";
import type { UpdateState } from "./updates";

/** Pestaña "Publicar": el texto de cada red (guardado o de partida) y su publicación. */
export type PublishOverview = {
	items: { platform: PlatformId; post: PostDraft; publication: PublicationView | null }[];
};

/** Resultado de una llamada IPC: errores como dato, no como excepción (mensajes limpios). */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type FrameflowApi = {
	app: {
		/** URL base del servidor local de medios (voces, renders…) para la vista previa. */
		mediaBaseUrl(): Promise<IpcResult<string>>;
	};
	updates: {
		state(): Promise<IpcResult<UpdateState>>;
		check(): Promise<IpcResult<UpdateState>>;
		/** Descarga la versión nueva (en macOS sin firma, abre la página de descarga). */
		download(): Promise<IpcResult<UpdateState>>;
		/** Reinicia e instala la versión descargada. */
		install(): Promise<IpcResult<UpdateState>>;
		onEvent(listener: (state: UpdateState) => void): () => void;
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
		/** Voz grabada de una escena (audio mono en Float32 y su frecuencia). Va como tarea "voice". */
		recordVoice(
			id: string,
			sceneId: string,
			pcm: Float32Array,
			sampleRate: number,
		): Promise<IpcResult<void>>;
		/** «Revisar guion»: la IA lee el guion guardado y propone cambios (no modifica nada). */
		reviewScript(id: string): Promise<IpcResult<ScriptReview>>;
		cancelReview(id: string): Promise<IpcResult<void>>;
		render(id: string): Promise<IpcResult<void>>;
		cancel(id: string): Promise<IpcResult<void>>;
		/** Abre el último MP4 en el reproductor del sistema, o lo muestra en el Finder. */
		openRender(id: string, how: "open" | "reveal"): Promise<IpcResult<void>>;
	};
	/** Exportar para redes: texto por red, carpeta lista para subir y registro de lo publicado. */
	publish: {
		overview(videoId: string): Promise<IpcResult<PublishOverview>>;
		saveDraft(
			videoId: string,
			platform: PlatformId,
			post: PostDraft,
		): Promise<IpcResult<PublicationView>>;
		export(
			videoId: string,
			platform: PlatformId,
			post: PostDraft,
		): Promise<IpcResult<PublicationView>>;
		/** La IA de Ajustes reescribe el texto de todas las redes. */
		improve(videoId: string): Promise<IpcResult<PublishOverview>>;
		/** Pega el enlace del post publicado (null = deshacer). */
		markPublished(
			videoId: string,
			platform: PlatformId,
			url: string | null,
		): Promise<IpcResult<PublicationView>>;
		openUpload(platform: PlatformId): Promise<IpcResult<void>>;
		reveal(path: string): Promise<IpcResult<void>>;
	};
	/** Suscripción al progreso de tareas largas; devuelve la función para darse de baja. */
	onJobEvent(listener: (event: JobEvent) => void): () => void;
};

export const IPC = {
	appMediaBaseUrl: "app:media-base-url",
	updatesState: "updates:state",
	updatesCheck: "updates:check",
	updatesDownload: "updates:download",
	updatesInstall: "updates:install",
	updatesEvent: "updates:event",
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
	videosRecordVoice: "videos:record-voice",
	videosReviewScript: "videos:review-script",
	videosCancelReview: "videos:cancel-review",
	videosRender: "videos:render",
	videosCancel: "videos:cancel",
	videosOpenRender: "videos:open-render",
	publishOverview: "publish:overview",
	publishSaveDraft: "publish:save-draft",
	publishExport: "publish:export",
	publishImprove: "publish:improve",
	publishMarkPublished: "publish:mark-published",
	publishOpenUpload: "publish:open-upload",
	publishReveal: "publish:reveal",
	jobEvent: "jobs:event",
} as const;

// Contrato entre el proceso principal (BD, archivos) y la interfaz (React).
// La interfaz nunca toca la BD: pide cosas por IPC a través de `window.frameflow`.
import type { NichePreset } from "@frameflow/core/presets";
import type {
	BrandKit,
	CreateProjectInput,
	ProjectSummary,
	ProjectWithBrand,
} from "@frameflow/core/project";
import type { Script } from "@frameflow/core/script";
import type { LlmStatus } from "@frameflow/core/script/ai";
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
		status(): Promise<IpcResult<LlmStatus>>;
	};
	videos: {
		list(projectId: string): Promise<IpcResult<VideoSummary[]>>;
		get(id: string): Promise<IpcResult<VideoDetail | null>>;
		create(input: CreateVideoInput): Promise<IpcResult<VideoDetail>>;
		saveScript(id: string, script: Script): Promise<IpcResult<VideoDetail>>;
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
	videosList: "videos:list",
	videosGet: "videos:get",
	videosCreate: "videos:create",
	videosSaveScript: "videos:save-script",
	videosGenerateVoice: "videos:generate-voice",
	videosRender: "videos:render",
	videosCancel: "videos:cancel",
	videosOpenRender: "videos:open-render",
	jobEvent: "jobs:event",
} as const;

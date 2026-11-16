// Contrato entre el proceso principal (BD, archivos) y la interfaz (React).
// La interfaz nunca toca la BD: pide cosas por IPC a través de `window.frameflow`.
import type { NichePreset } from "@frameflow/core/presets";
import type {
	BrandKit,
	CreateProjectInput,
	ProjectSummary,
	ProjectWithBrand,
} from "@frameflow/core/project";

/** Resultado de una llamada IPC: errores como dato, no como excepción (mensajes limpios). */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type FrameflowApi = {
	presets: {
		list(): Promise<IpcResult<NichePreset[]>>;
	};
	projects: {
		list(): Promise<IpcResult<ProjectSummary[]>>;
		get(id: string): Promise<IpcResult<ProjectWithBrand | null>>;
		create(input: CreateProjectInput): Promise<IpcResult<ProjectWithBrand>>;
		updateBrandKit(id: string, brandKit: BrandKit): Promise<IpcResult<ProjectWithBrand>>;
	};
};

export const IPC = {
	presetsList: "presets:list",
	projectsList: "projects:list",
	projectsGet: "projects:get",
	projectsCreate: "projects:create",
	projectsUpdateBrandKit: "projects:update-brand-kit",
} as const;

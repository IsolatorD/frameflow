import type { NichePreset } from "@frameflow/core/presets";
import type {
	BrandKit,
	CreateProjectInput,
	ProjectSummary,
	ProjectWithBrand,
} from "@frameflow/core/project";
import { unwrap } from "../../utils/unwrap/unwrap";

// Único punto de la interfaz que habla con el proceso principal.
// En una futura versión web, este service llamaría a una API HTTP con la misma forma.
export const projectsService = {
	listPresets: (): Promise<NichePreset[]> => unwrap(window.frameflow.presets.list()),
	list: (): Promise<ProjectSummary[]> => unwrap(window.frameflow.projects.list()),
	get: (id: string): Promise<ProjectWithBrand | null> => unwrap(window.frameflow.projects.get(id)),
	create: (input: CreateProjectInput): Promise<ProjectWithBrand> =>
		unwrap(window.frameflow.projects.create(input)),
	updateBrandKit: (id: string, brandKit: BrandKit): Promise<ProjectWithBrand> =>
		unwrap(window.frameflow.projects.updateBrandKit(id, brandKit)),
};

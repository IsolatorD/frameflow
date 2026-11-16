import type { NichePreset } from "@frameflow/core/presets";
import type { ProjectSummary } from "@frameflow/core/project";
import type { PresetOption } from "@frameflow/ui/src/organisms/CreateProjectForm/CreateProjectFormInterface";
import type { ProjectGridItem } from "@frameflow/ui/src/organisms/ProjectGrid/ProjectGridInterface";

export const toPresetOption = (preset: NichePreset): PresetOption => ({
	id: preset.id,
	label: preset.label,
	description: preset.description,
	colors: preset.theme,
});

export const toGridItem = (
	project: ProjectSummary,
	presets: readonly NichePreset[],
): ProjectGridItem => {
	const preset = presets.find((p) => p.id === project.presetId);
	return {
		id: project.id,
		name: project.name,
		description: project.description,
		presetLabel: preset?.label ?? project.presetId,
		languages: project.languages,
		colors: project.theme,
	};
};

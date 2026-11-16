import type { ProjectSummary } from "@frameflow/core/project";
import type { AppShellNavGroup } from "@frameflow/ui/src/templates/AppShell/AppShellInterface";
import { projectPath } from "../router/router";

/** Grupo "Proyectos" de la barra lateral, común a todas las pantallas. */
export function projectsNavGroup(
	projects: readonly ProjectSummary[],
	navigate: (path: string) => void,
	activeProjectId?: string,
): AppShellNavGroup {
	return {
		id: "projects",
		label: "Proyectos",
		items: [
			{
				id: "all",
				label: "Todos los proyectos",
				active: activeProjectId === undefined,
				onSelect: () => navigate("/"),
			},
			...projects.map((project) => ({
				id: project.id,
				label: project.name,
				dotColor: project.theme.accent,
				active: project.id === activeProjectId,
				onSelect: () => navigate(projectPath(project.id)),
			})),
		],
	};
}

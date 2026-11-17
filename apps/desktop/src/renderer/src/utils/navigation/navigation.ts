import type { ProjectSummary } from "@frameflow/core/project";
import type {
	AppShellNavGroup,
	AppShellNavItem,
} from "@frameflow/ui/src/templates/AppShell/AppShellInterface";
import { projectPath, SETTINGS_PATH } from "../router/router";

/** Grupo "Proyectos" de la barra lateral, común a todas las pantallas. */
export function projectsNavGroup(
	projects: readonly ProjectSummary[],
	navigate: (path: string) => void,
	/** Proyecto abierto; sin indicar = "Todos los proyectos"; null = ninguno (p. ej. en Ajustes). */
	activeProjectId?: string | null,
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

/** Pie de la barra lateral: Ajustes, en todas las pantallas. */
export const footerNav = (navigate: (path: string) => void, active = false): AppShellNavItem[] => [
	{ id: "settings", label: "Ajustes", active, onSelect: () => navigate(SETTINGS_PATH) },
];

import { createHashRouter } from "react-router";
import { ProjectPage } from "../../pages/ProjectPage/ProjectPage";
import { ProjectsPage } from "../../pages/ProjectsPage/ProjectsPage";

// Hash router: la app se carga desde un archivo local (file://) en producción.
export const router = createHashRouter([
	{ path: "/", element: <ProjectsPage /> },
	{ path: "/projects/:projectId", element: <ProjectPage /> },
	{ path: "/projects/:projectId/:section", element: <ProjectPage /> },
]);

export const projectPath = (projectId: string, section?: string) =>
	section && section !== "overview"
		? `/projects/${projectId}/${section}`
		: `/projects/${projectId}`;

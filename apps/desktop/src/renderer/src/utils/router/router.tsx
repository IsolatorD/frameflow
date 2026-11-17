import { createHashRouter } from "react-router";
import { ProjectPage } from "../../pages/ProjectPage/ProjectPage";
import { ProjectsPage } from "../../pages/ProjectsPage/ProjectsPage";
import { SettingsPage } from "../../pages/SettingsPage/SettingsPage";
import { VideoPage } from "../../pages/VideoPage/VideoPage";

// Hash router: la app se carga desde un archivo local (file://) en producción.
export const router = createHashRouter([
	{ path: "/", element: <ProjectsPage /> },
	{ path: "/settings", element: <SettingsPage /> },
	{ path: "/projects/:projectId", element: <ProjectPage /> },
	{ path: "/projects/:projectId/videos/:videoId", element: <VideoPage /> },
	{ path: "/projects/:projectId/:section", element: <ProjectPage /> },
]);

export const SETTINGS_PATH = "/settings";

export const projectPath = (projectId: string, section?: string) =>
	section && section !== "overview"
		? `/projects/${projectId}/${section}`
		: `/projects/${projectId}`;

export const videoPath = (projectId: string, videoId: string) =>
	`/projects/${projectId}/videos/${videoId}`;

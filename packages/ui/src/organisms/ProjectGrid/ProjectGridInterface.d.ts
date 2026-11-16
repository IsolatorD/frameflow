import type { ProjectCardProps } from "../../molecules/ProjectCard/ProjectCardInterface";

export interface ProjectGridItem extends Omit<ProjectCardProps, "onOpen"> {
	id: string;
}

export interface ProjectGridProps {
	projects: readonly ProjectGridItem[];
	onOpen: (id: string) => void;
	onCreate: () => void;
}

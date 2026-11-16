import { useQuery } from "@tanstack/react-query";
import { projectsService } from "../../services/projectsService/projectsService";

export const PROJECTS_KEY = ["projects"] as const;

export function useProjects() {
	return useQuery({ queryKey: PROJECTS_KEY, queryFn: projectsService.list });
}

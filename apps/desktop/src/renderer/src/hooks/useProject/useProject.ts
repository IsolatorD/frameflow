import { useQuery } from "@tanstack/react-query";
import { projectsService } from "../../services/projectsService/projectsService";
import { PROJECTS_KEY } from "../useProjects/useProjects";

export function useProject(id: string | undefined) {
	return useQuery({
		queryKey: [...PROJECTS_KEY, id],
		queryFn: () => projectsService.get(id ?? ""),
		enabled: Boolean(id),
	});
}

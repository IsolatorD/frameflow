import { useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsService } from "../../services/projectsService/projectsService";
import { PROJECTS_KEY } from "../useProjects/useProjects";

export function useCreateProject() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: projectsService.create,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
	});
}

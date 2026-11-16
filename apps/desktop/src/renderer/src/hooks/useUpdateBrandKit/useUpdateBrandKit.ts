import type { BrandKit } from "@frameflow/core/project";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsService } from "../../services/projectsService/projectsService";
import { PROJECTS_KEY } from "../useProjects/useProjects";

export function useUpdateBrandKit(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (brandKit: BrandKit) => projectsService.updateBrandKit(projectId, brandKit),
		// El proyecto guardado vuelve completo: se escribe en la caché sin otra ida y vuelta.
		onSuccess: (project) => {
			queryClient.setQueryData([...PROJECTS_KEY, projectId], project);
			// El listado muestra los colores de marca: se refresca solo él (exact).
			return queryClient.invalidateQueries({ queryKey: PROJECTS_KEY, exact: true });
		},
	});
}

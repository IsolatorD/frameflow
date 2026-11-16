import { useQuery } from "@tanstack/react-query";
import { projectsService } from "../../services/projectsService/projectsService";

export function usePresets() {
	return useQuery({
		queryKey: ["presets"],
		queryFn: projectsService.listPresets,
		staleTime: Number.POSITIVE_INFINITY, // vienen en el código: no cambian en la sesión
	});
}

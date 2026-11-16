import { useQuery } from "@tanstack/react-query";
import { videosService } from "../../services/videosService/videosService";

/** ¿Hay un modelo de IA listo para el modo automático? Se vuelve a comprobar al volver a la app. */
export function useAiStatus() {
	return useQuery({
		queryKey: ["ai", "status"],
		queryFn: videosService.aiStatus,
		staleTime: 30_000,
	});
}

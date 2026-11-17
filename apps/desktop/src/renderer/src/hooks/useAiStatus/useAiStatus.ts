import { useQuery } from "@tanstack/react-query";
import { aiService } from "../../services/aiService/aiService";

/** ¿La IA elegida en Ajustes está lista para el modo automático? Se vuelve a comprobar al volver a la app. */
export function useAiStatus() {
	return useQuery({
		queryKey: ["ai", "status"],
		queryFn: aiService.status,
		staleTime: 30_000,
	});
}

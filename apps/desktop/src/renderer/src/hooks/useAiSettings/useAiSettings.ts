import type { AiSettings, AiSettingsView, CloudProviderId } from "@frameflow/core/ai/catalog";
import type { LocalAiState } from "@frameflow/core/ai/localRuntime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { aiService } from "../../services/aiService/aiService";

export const AI_KEY = ["ai"] as const;
const SETTINGS_KEY = [...AI_KEY, "settings"] as const;

/** Ajustes de IA + estado del equipo (Ollama, RAM). Se refresca al volver a la ventana. */
export function useAiSettings() {
	return useQuery({ queryKey: SETTINGS_KEY, queryFn: aiService.settings });
}

/** Cambiar proveedor o modelo. Se aplica al instante en la pantalla y se guarda. */
export function useSaveAiSettings() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: aiService.saveSettings,
		onMutate: async (settings: AiSettings) => {
			await queryClient.cancelQueries({ queryKey: SETTINGS_KEY });
			const previous = queryClient.getQueryData<AiSettingsView>(SETTINGS_KEY);
			if (previous) queryClient.setQueryData(SETTINGS_KEY, { ...previous, settings });
			return { previous };
		},
		onError: (_error, _settings, context) => {
			if (context?.previous) queryClient.setQueryData(SETTINGS_KEY, context.previous);
		},
		// El estado de la IA (y los avisos del formulario de video) dependen de los ajustes.
		onSettled: () => queryClient.invalidateQueries({ queryKey: AI_KEY }),
	});
}

/** Guardar o quitar (null) la clave de un proveedor en la nube. */
export function useSetAiKey() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ provider, key }: { provider: CloudProviderId; key: string | null }) =>
			aiService.setKey(provider, key),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: AI_KEY }),
	});
}

/** Probar proveedor y modelo sin gastar tokens. */
export function useTestAi() {
	return useMutation({
		mutationFn: ({ provider, model }: { provider: AiSettings["provider"]; model: string }) =>
			aiService.test(provider, model),
	});
}

/**
 * Progreso de la preparación de la IA local (descarga de Ollama y del modelo), que corre en el
 * proceso principal aunque se cambie de pantalla. Al terminar se refresca todo lo de la IA.
 */
export function useLocalAiEvents() {
	const queryClient = useQueryClient();
	useEffect(
		() =>
			aiService.onLocalEvent((local: LocalAiState) => {
				queryClient.setQueryData<AiSettingsView>(SETTINGS_KEY, (view) =>
					view ? { ...view, local } : view,
				);
				if (local.job && local.job.status !== "running")
					void queryClient.invalidateQueries({ queryKey: AI_KEY });
			}),
		[queryClient],
	);
}

export function usePrepareLocalAi() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: aiService.prepareLocal,
		onSuccess: (local) =>
			queryClient.setQueryData<AiSettingsView>(SETTINGS_KEY, (view) =>
				view ? { ...view, local } : view,
			),
	});
}

export function useCancelLocalAi() {
	return useMutation({ mutationFn: aiService.cancelLocal });
}

export function useDismissLocalAi() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: aiService.dismissLocal,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: AI_KEY }),
	});
}

import { QueryClient } from "@tanstack/react-query";

// Datos locales (IPC): no hace falta refetch agresivo como con una API remota.
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: false },
	},
});

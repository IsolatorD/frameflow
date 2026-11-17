import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { UpdateState } from "../../../../shared/updates";
import { updatesService } from "../../services/updatesService/updatesService";

const UPDATES_KEY = ["updates"] as const;

/** Estado de las actualizaciones, al día con los eventos del proceso principal. */
export function useUpdates() {
	const queryClient = useQueryClient();
	useEffect(
		() =>
			updatesService.onEvent((state) => queryClient.setQueryData<UpdateState>(UPDATES_KEY, state)),
		[queryClient],
	);
	const state = useQuery({ queryKey: UPDATES_KEY, queryFn: updatesService.state });
	const onSuccess = (data: UpdateState) => queryClient.setQueryData(UPDATES_KEY, data);
	return {
		state: state.data,
		check: useMutation({ mutationFn: updatesService.check, onSuccess }),
		download: useMutation({ mutationFn: updatesService.download, onSuccess }),
		install: useMutation({ mutationFn: updatesService.install, onSuccess }),
	};
}

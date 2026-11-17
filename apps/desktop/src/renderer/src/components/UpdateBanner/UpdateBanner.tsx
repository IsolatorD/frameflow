import { UpdateNotice } from "@frameflow/ui/src/molecules/UpdateNotice/UpdateNotice";
import { useNavigate } from "react-router";
import { useUpdates } from "../../hooks/useUpdates/useUpdates";
import { SETTINGS_PATH } from "../../utils/router/router";

/** Aviso de versión nueva para la barra lateral (no muestra nada si no hay). */
export function UpdateBanner() {
	const navigate = useNavigate();
	const { state, download, install } = useUpdates();
	if (!state?.version) return null;
	if (state.status !== "available" && state.status !== "downloading" && state.status !== "ready")
		return null;
	return (
		<UpdateNotice
			version={state.version}
			status={state.status}
			progress={state.progress}
			canInstall={state.canInstall}
			busy={state.busy}
			onDownload={() => download.mutate()}
			onInstall={() => install.mutate()}
			onDetails={() => navigate(SETTINGS_PATH)}
		/>
	);
}

import type { UpdateState } from "../../../../shared/updates";
import { unwrap } from "../../utils/unwrap/unwrap";

// Actualizaciones de la app (las gestiona el proceso principal con electron-updater).
export const updatesService = {
	state: (): Promise<UpdateState> => unwrap(window.frameflow.updates.state()),
	check: (): Promise<UpdateState> => unwrap(window.frameflow.updates.check()),
	download: (): Promise<UpdateState> => unwrap(window.frameflow.updates.download()),
	install: (): Promise<UpdateState> => unwrap(window.frameflow.updates.install()),
	onEvent: (listener: (state: UpdateState) => void) => window.frameflow.updates.onEvent(listener),
};

import type { AiSettings, AiSettingsView, CloudProviderId } from "@frameflow/core/ai/catalog";
import type { LlmStatus } from "@frameflow/core/script/ai";
import { unwrap } from "../../utils/unwrap/unwrap";

// Ajustes de la IA que escribe los guiones. Las claves solo viajan hacia el proceso principal.
export const aiService = {
	status: (): Promise<LlmStatus> => unwrap(window.frameflow.ai.status()),
	settings: (): Promise<AiSettingsView> => unwrap(window.frameflow.ai.settings()),
	saveSettings: (settings: AiSettings): Promise<AiSettings> =>
		unwrap(window.frameflow.ai.saveSettings(settings)),
	setKey: (provider: CloudProviderId, key: string | null): Promise<void> =>
		unwrap(window.frameflow.ai.setKey(provider, key)),
	test: (provider: AiSettings["provider"], model: string): Promise<LlmStatus> =>
		unwrap(window.frameflow.ai.test(provider, model)),
};

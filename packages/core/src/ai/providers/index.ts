import { OllamaProvider } from "../../script/ai";
import { type AiSettings, type CloudProviderId, isCloudProvider, PROVIDERS } from "../catalog";
import { AnthropicProvider } from "./anthropic";
import type { CloudLlm, ConfiguredLlm } from "./cloud";
import { GeminiProvider } from "./gemini";
import { OpenAiProvider } from "./openai";

export type { CloudLlm, ConfiguredLlm } from "./cloud";
export { AiProviderError, portableJsonSchema } from "./shared";

export const createCloudLlm = (
	provider: CloudProviderId,
	model: string,
	apiKey: string,
): CloudLlm => {
	switch (provider) {
		case "anthropic":
			return new AnthropicProvider(model, apiKey);
		case "openai":
			return new OpenAiProvider(model, apiKey);
		case "gemini":
			return new GeminiProvider(model, apiKey);
	}
};

/** Proveedor elegido en Ajustes. Sin clave, devuelve uno que explica qué falta. */
export function createLlm(
	settings: AiSettings,
	apiKey: string | null,
	ollamaUrl?: string,
): ConfiguredLlm {
	const model = settings.models[settings.provider];
	if (!isCloudProvider(settings.provider)) return new OllamaProvider(model, ollamaUrl);
	if (apiKey) return createCloudLlm(settings.provider, model, apiKey);
	const label = PROVIDERS[settings.provider].label;
	const reason = `Falta la clave de API de ${label}. Añádela en Ajustes.`;
	return {
		name: label,
		status: async () => ({ available: false, name: label, reason }),
		generateJson: async () => {
			throw new Error(reason);
		},
	};
}

import Anthropic from "@anthropic-ai/sdk";
import type { LlmMessage, LlmOptions, LlmStatus } from "../../script/ai";
import { modelLabel } from "../catalog";
import type { CloudLlm } from "./cloud";
import { AiProviderError, errorForStatus, portableJsonSchema, splitSystem } from "./shared";

// Modelos con reintento automático en el servidor si el filtro de seguridad rechaza la petición.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

/** Claude con la clave del usuario. Salida estructurada con JSON Schema (`output_config.format`). */
export class AnthropicProvider implements CloudLlm {
	readonly name: string;
	private readonly client: Anthropic;

	constructor(
		private readonly model: string,
		apiKey: string,
		client?: Anthropic,
	) {
		this.name = modelLabel("anthropic", model);
		this.client = client ?? new Anthropic({ apiKey, maxRetries: 2 });
	}

	async status(): Promise<LlmStatus> {
		return { available: true, name: this.name };
	}

	/** Comprueba clave y modelo sin gastar tokens. */
	async test(): Promise<LlmStatus> {
		try {
			await this.client.models.retrieve(this.model);
			return { available: true, name: this.name };
		} catch (error) {
			return { available: false, name: this.name, reason: this.explain(error).message };
		}
	}

	async generateJson(
		messages: LlmMessage[],
		jsonSchema: object,
		options: LlmOptions = {},
	): Promise<string> {
		const { system, turns } = splitSystem(messages);
		const fallback = FALLBACK_MODELS.has(this.model);
		let response: Anthropic.Beta.BetaMessage;
		try {
			response = await this.client.beta.messages.create(
				{
					model: this.model,
					max_tokens: 16000,
					system,
					messages: turns,
					// El razonamiento va siempre activo en estos modelos; "effort" decide cuánto.
					output_config: {
						effort: options.think ? "high" : "low",
						format: { type: "json_schema", schema: portableJsonSchema(jsonSchema) },
					},
					...(fallback
						? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
						: {}),
				},
				{ signal: options.signal },
			);
		} catch (error) {
			throw this.explain(error);
		}
		if (response.stop_reason === "refusal")
			throw new AiProviderError(
				"Claude ha rechazado escribir este guion. Prueba a reformular el tema.",
				"refusal",
			);
		if (response.stop_reason === "max_tokens")
			throw new AiProviderError("La respuesta de Claude se cortó antes de terminar.", "truncated");
		const text = response.content
			.filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
			.map((block) => block.text)
			.join("");
		if (!text) throw new AiProviderError("Claude no devolvió ningún texto.", "other");
		return text;
	}

	private explain(error: unknown): Error {
		if (error instanceof Anthropic.APIUserAbortError) return error;
		if (error instanceof Anthropic.APIConnectionError)
			return errorForStatus("anthropic", this.model, undefined, error.message);
		if (error instanceof Anthropic.APIError)
			return errorForStatus("anthropic", this.model, error.status, error.message);
		return error instanceof Error ? error : new Error(String(error));
	}
}

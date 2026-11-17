import OpenAI from "openai";
import type { LlmMessage, LlmOptions, LlmStatus } from "../../script/ai";
import { modelLabel } from "../catalog";
import type { CloudLlm } from "./cloud";
import { AiProviderError, errorForStatus, portableJsonSchema } from "./shared";

/** OpenAI con la clave del usuario (Responses API, salida estructurada estricta). */
export class OpenAiProvider implements CloudLlm {
	readonly name: string;
	private readonly client: OpenAI;

	constructor(
		private readonly model: string,
		apiKey: string,
		client?: OpenAI,
	) {
		this.name = modelLabel("openai", model);
		this.client = client ?? new OpenAI({ apiKey, maxRetries: 2 });
	}

	async status(): Promise<LlmStatus> {
		return { available: true, name: this.name };
	}

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
		let response: OpenAI.Responses.Response;
		try {
			response = await this.client.responses.create(
				{
					model: this.model,
					input: messages.map((m) => ({ role: m.role, content: m.content })),
					reasoning: { effort: options.think ? "medium" : "low" },
					text: {
						format: {
							type: "json_schema",
							name: "guion",
							schema: portableJsonSchema(jsonSchema),
							strict: true,
						},
					},
				},
				{ signal: options.signal },
			);
		} catch (error) {
			throw this.explain(error);
		}
		if (response.status === "incomplete")
			throw new AiProviderError(
				`La respuesta de OpenAI se cortó (${response.incomplete_details?.reason ?? "motivo desconocido"}).`,
				"truncated",
			);
		if (!response.output_text)
			throw new AiProviderError("OpenAI no devolvió ningún texto.", "other");
		return response.output_text;
	}

	private explain(error: unknown): Error {
		if (error instanceof OpenAI.APIUserAbortError) return error;
		if (error instanceof OpenAI.APIConnectionError)
			return errorForStatus("openai", this.model, undefined, error.message);
		if (error instanceof OpenAI.APIError)
			return errorForStatus("openai", this.model, error.status, error.message);
		return error instanceof Error ? error : new Error(String(error));
	}
}

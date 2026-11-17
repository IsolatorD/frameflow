import { ApiError, GoogleGenAI } from "@google/genai";
import type { LlmMessage, LlmOptions, LlmStatus } from "../../script/ai";
import { modelLabel } from "../catalog";
import type { CloudLlm } from "./cloud";
import { AiProviderError, errorForStatus, portableJsonSchema, splitSystem } from "./shared";

/** Gemini con la clave de Google AI Studio (salida JSON con `responseJsonSchema`). */
export class GeminiProvider implements CloudLlm {
	readonly name: string;
	private readonly client: GoogleGenAI;

	constructor(
		private readonly model: string,
		apiKey: string,
		client?: GoogleGenAI,
	) {
		this.name = modelLabel("gemini", model);
		this.client = client ?? new GoogleGenAI({ apiKey });
	}

	async status(): Promise<LlmStatus> {
		return { available: true, name: this.name };
	}

	async test(): Promise<LlmStatus> {
		try {
			await this.client.models.get({ model: this.model });
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
		let text: string | undefined;
		try {
			const response = await this.client.models.generateContent({
				model: this.model,
				contents: turns.map((m) => ({
					role: m.role === "assistant" ? "model" : "user",
					parts: [{ text: m.content }],
				})),
				config: {
					systemInstruction: system || undefined,
					responseMimeType: "application/json",
					responseJsonSchema: portableJsonSchema(jsonSchema),
					abortSignal: options.signal,
				},
			});
			text = response.text;
		} catch (error) {
			throw this.explain(error);
		}
		if (!text) throw new AiProviderError("Gemini no devolvió ningún texto.", "other");
		return text;
	}

	private explain(error: unknown): Error {
		if (error instanceof ApiError)
			return errorForStatus("gemini", this.model, error.status, error.message);
		if (error instanceof Error && error.name === "AbortError") return error;
		if (error instanceof TypeError)
			return errorForStatus("gemini", this.model, undefined, error.message);
		return error instanceof Error ? error : new Error(String(error));
	}
}

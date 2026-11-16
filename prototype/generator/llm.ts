// Abstracción mínima de proveedor de LLM. Hoy: Ollama local.
// Mañana: Claude/OpenAI implementando la misma interfaz.

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

export interface LlmProvider {
	readonly name: string;
	/** Devuelve texto JSON que cumple `jsonSchema`. */
	generateJson(messages: LlmMessage[], jsonSchema: object): Promise<string>;
}

export class OllamaProvider implements LlmProvider {
	readonly name: string;

	constructor(
		private readonly model = process.env.FRAMEFLOW_MODEL ?? "qwen3:8b",
		private readonly baseUrl = process.env.OLLAMA_URL ?? "http://localhost:11434",
	) {
		this.name = `ollama:${model}`;
	}

	async generateJson(messages: LlmMessage[], jsonSchema: object): Promise<string> {
		const res = await fetch(`${this.baseUrl}/api/chat`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				model: this.model,
				messages,
				format: jsonSchema, // salida estructurada: Ollama restringe la respuesta al esquema
				stream: false,
				think: false,
				options: { temperature: 0.7 },
			}),
		});
		if (!res.ok) {
			throw new Error(`Ollama respondió ${res.status}: ${await res.text()}`);
		}
		const data = (await res.json()) as { message: { content: string } };
		return data.message.content;
	}
}

import Anthropic from "@anthropic-ai/sdk";
import { ApiError, type GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { defaultAiSettings } from "../catalog";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { createLlm } from "./index";
import { OpenAiProvider } from "./openai";
import { AiProviderError, portableJsonSchema } from "./shared";

const messages = [
	{ role: "system" as const, content: "Eres guionista." },
	{ role: "user" as const, content: "Tema: Marte" },
];
const schema = z.toJSONSchema(
	z.object({
		title: z.string().min(1),
		scenes: z.array(z.object({ narration: z.string().max(200), value: z.number() })).min(3),
	}),
);

describe("portableJsonSchema", () => {
	it("quita restricciones no portables y cierra los objetos", () => {
		const out = portableJsonSchema(schema);
		const text = JSON.stringify(out);
		expect(text).not.toMatch(/minLength|maxLength|minItems|\$schema/);
		expect(out.additionalProperties).toBe(false);
		expect(out.required).toEqual(["title", "scenes"]);
		const scene = (out.properties as Record<string, { items: Record<string, unknown> }>).scenes
			?.items;
		expect(scene?.required).toEqual(["narration", "value"]);
		// Un campo que se llame como una restricción no se borra.
		const named = portableJsonSchema({
			type: "object",
			properties: { format: { type: "string" } },
		});
		expect(Object.keys(named.properties as object)).toEqual(["format"]);
	});
});

const anthropicClient = (create: (body: unknown) => unknown) =>
	({
		beta: { messages: { create: vi.fn(async (body: unknown) => create(body)) } },
		models: { retrieve: vi.fn(async () => ({})) },
	}) as unknown as Anthropic;

describe("AnthropicProvider", () => {
	it("envía el sistema aparte, el esquema portable y el esfuerzo; devuelve el texto", async () => {
		const client = anthropicClient(() => ({
			stop_reason: "end_turn",
			content: [
				{ type: "thinking", thinking: "" },
				{ type: "text", text: '{"ok":true}' },
			],
		}));
		const llm = new AnthropicProvider("claude-opus-5-5", "k", client);
		expect(await llm.generateJson(messages, schema, { think: true })).toBe('{"ok":true}');
		const body = vi.mocked(client.beta.messages.create).mock.calls[0]?.[0] as unknown as Record<
			string,
			unknown
		>;
		expect(body.system).toBe("Eres guionista.");
		expect(body.messages).toEqual([{ role: "user", content: "Tema: Marte" }]);
		expect(body.output_config).toMatchObject({ effort: "high", format: { type: "json_schema" } });
		expect(body.fallbacks).toBe("default");
		expect(body).not.toHaveProperty("temperature");
		expect(llm.name).toBe("Claude Opus 5.5");
	});

	it("sin reintento en el servidor para Haiku", async () => {
		const client = anthropicClient(() => ({
			stop_reason: "end_turn",
			content: [{ type: "text", text: "{}" }],
		}));
		await new AnthropicProvider("claude-haiku-5-5", "k", client).generateJson(messages, schema);
		const body = vi.mocked(client.beta.messages.create).mock.calls[0]?.[0] as unknown as Record<
			string,
			unknown
		>;
		expect(body).not.toHaveProperty("fallbacks");
		expect(body.output_config).toMatchObject({ effort: "low" });
	});

	it("traduce rechazos y claves inválidas a mensajes claros", async () => {
		const refusing = new AnthropicProvider(
			"claude-opus-5-5",
			"k",
			anthropicClient(() => ({ stop_reason: "refusal", content: [] })),
		);
		await expect(refusing.generateJson(messages, schema)).rejects.toMatchObject({
			kind: "refusal",
		});

		const unauthorized = new Anthropic.AuthenticationError(
			401,
			undefined,
			"invalid x-api-key",
			new Headers(),
		);
		const client = anthropicClient(() => {
			throw unauthorized;
		});
		vi.mocked(client.models.retrieve).mockRejectedValue(unauthorized);
		const llm = new AnthropicProvider("claude-opus-5-5", "k", client);
		await expect(llm.generateJson(messages, schema)).rejects.toThrow(/clave de API de Claude/);
		expect(await llm.test()).toMatchObject({ available: false });
	});
});

describe("OpenAiProvider", () => {
	it("usa salida estricta y devuelve output_text", async () => {
		const create = vi.fn(async () => ({ status: "completed", output_text: '{"a":1}' }));
		const client = { responses: { create } } as unknown as OpenAI;
		const llm = new OpenAiProvider("gpt-6.1-sol", "k", client);
		expect(await llm.generateJson(messages, schema, { think: true })).toBe('{"a":1}');
		const body = create.mock.calls[0]?.[0 as never] as unknown as Record<string, unknown>;
		expect(body.text).toMatchObject({ format: { type: "json_schema", strict: true } });
		expect(body.reasoning).toEqual({ effort: "medium" });
		expect(body.input).toEqual(messages);
	});

	it("un modelo inexistente da un mensaje que lleva a Ajustes", async () => {
		const notFound = new OpenAI.NotFoundError(404, undefined, "model not found", new Headers());
		const client = {
			responses: {
				create: vi.fn(async () => {
					throw notFound;
				}),
			},
		} as unknown as OpenAI;
		await expect(
			new OpenAiProvider("gpt-9", "k", client).generateJson(messages, schema),
		).rejects.toThrow(/El modelo "gpt-9" no existe/);
	});
});

describe("GeminiProvider", () => {
	it("convierte los turnos al formato de Gemini y pide JSON", async () => {
		const generateContent = vi.fn(async () => ({ text: '{"b":2}' }));
		const client = { models: { generateContent } } as unknown as GoogleGenAI;
		const llm = new GeminiProvider("gemini-3.8-flash", "k", client);
		const out = await llm.generateJson(
			[...messages, { role: "assistant", content: "{}" }, { role: "user", content: "Corrige" }],
			schema,
		);
		expect(out).toBe('{"b":2}');
		const req = generateContent.mock.calls[0]?.[0 as never] as unknown as {
			contents: { role: string }[];
			config: Record<string, unknown>;
		};
		expect(req.contents.map((c) => c.role)).toEqual(["user", "model", "user"]);
		expect(req.config.systemInstruction).toBe("Eres guionista.");
		expect(req.config.responseMimeType).toBe("application/json");
	});

	it("límite de uso → mensaje de cuota", async () => {
		const client = {
			models: {
				generateContent: vi.fn(async () => {
					throw new ApiError({ message: "quota", status: 429 });
				}),
			},
		} as unknown as GoogleGenAI;
		const error = await new GeminiProvider("gemini-3.8-flash", "k", client)
			.generateJson(messages, schema)
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(AiProviderError);
		expect((error as AiProviderError).kind).toBe("quota");
	});
});

describe("createLlm", () => {
	it("sin clave, el proveedor en la nube explica qué falta", async () => {
		const llm = createLlm({ ...defaultAiSettings(), provider: "openai" }, null);
		expect(await llm.status()).toMatchObject({
			available: false,
			reason: expect.stringMatching(/Falta la clave de API de OpenAI/),
		});
	});

	it("con Ollama usa el modelo local elegido", () => {
		expect(createLlm(defaultAiSettings(), null).name).toBe("Qwen3 8B (en este equipo)");
	});
});

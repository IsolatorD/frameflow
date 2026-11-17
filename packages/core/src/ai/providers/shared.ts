import type { LlmMessage } from "../../script/ai";
import { type AiProviderId, PROVIDERS } from "../catalog";

// Palabras de JSON Schema que no todos los proveedores aceptan en la salida estructurada.
// No hacen falta: el guion se valida después con Zod y el error se le devuelve a la IA.
const UNPORTABLE = new Set([
	"$schema",
	"minLength",
	"maxLength",
	"minimum",
	"maximum",
	"exclusiveMinimum",
	"exclusiveMaximum",
	"minItems",
	"maxItems",
	"pattern",
	"format",
]);

/**
 * Esquema aceptado por Claude, OpenAI (modo estricto) y Gemini: sin restricciones numéricas ni
 * de longitud, todo objeto cerrado (`additionalProperties: false`) y con todos sus campos obligatorios.
 */
export function portableJsonSchema(schema: unknown): Record<string, unknown> {
	const walk = (node: unknown): unknown => {
		if (Array.isArray(node)) return node.map(walk);
		if (!node || typeof node !== "object") return node;
		const out: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(node)) {
			if (UNPORTABLE.has(key)) continue;
			out[key] = key === "properties" ? mapValues(value, walk) : walk(value);
		}
		if (out.type === "object" && out.properties && typeof out.properties === "object") {
			out.additionalProperties = false;
			out.required = Object.keys(out.properties);
		}
		return out;
	};
	return walk(schema) as Record<string, unknown>;
}

const mapValues = (value: unknown, fn: (v: unknown) => unknown) =>
	value && typeof value === "object"
		? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fn(v)]))
		: value;

/** Separa las instrucciones de sistema del diálogo (Claude y Gemini las piden aparte). */
export function splitSystem(messages: readonly LlmMessage[]) {
	const system = messages
		.filter((m) => m.role === "system")
		.map((m) => m.content)
		.join("\n\n");
	const turns = messages.filter(
		(m): m is LlmMessage & { role: "user" | "assistant" } => m.role !== "system",
	);
	return { system, turns };
}

/** Error de la IA con un mensaje pensado para la persona que usa la app. */
export class AiProviderError extends Error {
	constructor(
		message: string,
		readonly kind: "auth" | "model" | "quota" | "network" | "refusal" | "truncated" | "other",
	) {
		super(message);
		this.name = "AiProviderError";
	}
}

/** Traduce un código HTTP del proveedor a un mensaje claro. */
export function errorForStatus(
	provider: AiProviderId,
	model: string,
	status: number | undefined,
	detail: string,
): AiProviderError {
	const name = PROVIDERS[provider].label;
	if (status === 401 || status === 403)
		return new AiProviderError(
			`La clave de API de ${name} no es válida o no tiene permisos. Revísala en Ajustes.`,
			"auth",
		);
	if (status === 404)
		return new AiProviderError(
			`El modelo "${model}" no existe en ${name} o tu cuenta no tiene acceso. Elige otro en Ajustes.`,
			"model",
		);
	if (status === 429)
		return new AiProviderError(
			`${name} ha rechazado la petición por límite de uso o falta de saldo. Prueba más tarde o revisa tu cuenta.`,
			"quota",
		);
	if (status === undefined)
		return new AiProviderError(
			`No se pudo conectar con ${name}. Revisa tu conexión a internet.`,
			"network",
		);
	return new AiProviderError(`${name} respondió con un error (${status}): ${detail}`, "other");
}

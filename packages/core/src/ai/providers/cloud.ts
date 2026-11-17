import type { LlmProvider, LlmStatus } from "../../script/ai";

/** Proveedor que la app puede usar: escribe JSON, dice si está listo y se puede probar. */
export interface ConfiguredLlm extends LlmProvider {
	/** Comprobación rápida (sin red en la nube): ¿se puede generar ahora? */
	status(): Promise<LlmStatus>;
}

/** Proveedor en la nube: además se puede probar de verdad (clave y modelo) sin gastar tokens. */
export interface CloudLlm extends ConfiguredLlm {
	test(): Promise<LlmStatus>;
}

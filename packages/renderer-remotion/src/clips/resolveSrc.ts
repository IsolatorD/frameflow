import { staticFile } from "remotion";

/** URLs se usan tal cual; rutas relativas se sirven desde la carpeta public del render. */
export const resolveSrc = (src: string): string =>
	/^(https?:|data:|blob:|file:)/.test(src) ? src : staticFile(src);

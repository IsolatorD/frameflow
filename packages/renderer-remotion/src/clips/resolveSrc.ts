import { createContext, useContext } from "react";
import { staticFile } from "remotion";

/**
 * Base de las rutas relativas de los clips (p. ej. "http://127.0.0.1:5123/<token>/astroinfo/").
 * La app de escritorio la pasa como prop; sin ella se usa la carpeta public de Remotion.
 */
export const MediaBaseContext = createContext<string | undefined>(undefined);

const resolve = (src: string, base: string | undefined): string => {
	if (/^(https?:|data:|blob:|file:)/.test(src)) return src;
	if (base) return `${base.replace(/\/$/, "")}/${src.split("/").map(encodeURIComponent).join("/")}`;
	return staticFile(src);
};

export const useResolveSrc = () => {
	const base = useContext(MediaBaseContext);
	return (src: string) => resolve(src, base);
};

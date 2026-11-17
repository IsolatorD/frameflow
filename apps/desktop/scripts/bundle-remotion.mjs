// Empaqueta la composición de Remotion (packages/renderer-remotion) para la app instalada, que no
// lleva webpack ni el código fuente. Resultado: build/remotion-bundle (electron-builder lo copia a
// resources/remotion-bundle). En desarrollo no hace falta: la app lo empaqueta al vuelo.
import { rmSync } from "node:fs";
import { join } from "node:path";
import { bundle } from "@remotion/bundler";

const appDir = join(import.meta.dirname, "..");
const outDir = join(appDir, "build/remotion-bundle");
rmSync(outDir, { recursive: true, force: true });
const started = Date.now();
await bundle({
	entryPoint: join(appDir, "../../packages/renderer-remotion/src/index.ts"),
	outDir,
	onProgress: (p) => process.stdout.write(`\rRemotion: ${p} %`),
});
console.log(
	`\nComposición empaquetada en ${outDir} (${Math.round((Date.now() - started) / 1000)} s)`,
);

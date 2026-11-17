import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
	main: {
		// Los paquetes del monorepo (@frameflow/*) se empaquetan; el resto queda en node_modules.
		plugins: [
			externalizeDepsPlugin({
				exclude: ["@frameflow/core", "@frameflow/db"],
				// Solo en desarrollo (webpack de Remotion); la app instalada usa el paquete ya hecho.
				include: ["@remotion/bundler"],
			}),
		],
		build: {
			rollupOptions: {
				input: {
					index: resolve("src/main/index.ts"),
					// eSpeak NG (GPL-3.0) va en su propio proceso: ver src/main/espeak-process.ts.
					"espeak-process": resolve("src/main/espeak-process.ts"),
				},
			},
		},
	},
	preload: {
		plugins: [externalizeDepsPlugin()],
	},
	renderer: {
		resolve: { alias: { "@renderer": resolve("src/renderer/src") } },
		plugins: [react(), tailwindcss()],
	},
});

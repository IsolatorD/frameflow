import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
	main: {
		// Los paquetes del monorepo (@frameflow/*) se empaquetan; el resto queda en node_modules.
		plugins: [externalizeDepsPlugin({ exclude: ["@frameflow/core", "@frameflow/db"] })],
	},
	preload: {
		plugins: [externalizeDepsPlugin()],
	},
	renderer: {
		resolve: { alias: { "@renderer": resolve("src/renderer/src") } },
		plugins: [react(), tailwindcss()],
	},
});

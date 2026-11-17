import { describe, expect, it } from "vitest";
import {
	aggregatePull,
	checksumFor,
	formatBytes,
	isRetryablePullError,
	manifestPath,
	ollamaAsset,
	releaseUrl,
	requiredBytes,
} from "./localRuntime";

describe("runtime local de Ollama", () => {
	it("elige el paquete oficial según sistema y arquitectura", () => {
		expect(ollamaAsset("darwin", "arm64")?.name).toBe("ollama-darwin.tgz");
		expect(ollamaAsset("darwin", "x64")?.name).toBe("ollama-darwin.tgz");
		expect(ollamaAsset("win32", "x64")?.format).toBe("zip");
		expect(ollamaAsset("win32", "arm64")?.name).toBe("ollama-windows-arm64.zip");
		expect(ollamaAsset("linux", "x64")?.format).toBe("tar.zst");
		expect(ollamaAsset("freebsd", "x64")).toBeNull();
		expect(releaseUrl("ollama-darwin.tgz", "v1.0.0")).toBe(
			"https://github.com/ollama/ollama/releases/download/v1.0.0/ollama-darwin.tgz",
		);
	});

	it("lee el hash del archivo en sha256sum.txt", () => {
		const a = "a".repeat(64);
		const b = "B".repeat(64);
		const sums = `${a}  ./ollama-darwin.tgz\r\n${b} *ollama-windows-amd64.zip\n`;
		expect(checksumFor(sums, "ollama-darwin.tgz")).toBe(a);
		expect(checksumFor(sums, "ollama-windows-amd64.zip")).toBe("b".repeat(64));
		expect(checksumFor(sums, "ollama-linux-amd64.tar.zst")).toBeNull();
	});

	it("suma el progreso de todas las capas del modelo", () => {
		let state = aggregatePull(new Map(), { status: "pulling manifest" });
		expect(state.progress).toBeNull();
		state = aggregatePull(state.layers, { digest: "sha256:a", total: 100, completed: 50 });
		state = aggregatePull(state.layers, { digest: "sha256:b", total: 300, completed: 0 });
		expect(state.progress).toEqual({ done: 50, total: 400 });
		state = aggregatePull(state.layers, { digest: "sha256:a", total: 100, completed: 100 });
		state = aggregatePull(state.layers, { digest: "sha256:b", total: 300, completed: 150 });
		expect(state.progress).toEqual({ done: 250, total: 400 });
	});

	it("sabe dónde está el manifiesto de cada modelo", () => {
		expect(manifestPath("hf.co/unsloth/Qwen3-8B-GGUF:Q4_K_M").join("/")).toBe(
			"manifests/hf.co/unsloth/Qwen3-8B-GGUF/Q4_K_M",
		);
		expect(manifestPath("qwen3:8b").join("/")).toBe(
			"manifests/registry.ollama.ai/library/qwen3/8b",
		);
		expect(manifestPath("usuario/modelo").join("/")).toBe(
			"manifests/registry.ollama.ai/usuario/modelo/latest",
		);
	});

	it("reintenta solo errores de red", () => {
		expect(isRetryablePullError("max retries exceeded: EOF")).toBe(true);
		expect(isRetryablePullError("pull model manifest: file does not exist")).toBe(false);
	});

	it("calcula el espacio necesario y lo formatea", () => {
		const runtime = ollamaAsset("darwin", "arm64");
		const bytes = requiredBytes({ runtime, modelGb: 5 });
		expect(bytes).toBeGreaterThan(5 * 1024 ** 3);
		expect(requiredBytes({ runtime: null, modelGb: null })).toBe(Math.ceil(0.5 * 1024 ** 3));
		expect(formatBytes(186 * 1024 ** 2)).toBe("186 MB");
		expect(formatBytes(5.25 * 1024 ** 3)).toBe("5,3 GB");
	});
});

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assembleStoryboard, starterScript } from "@frameflow/core/script";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Database, openDatabase } from "../client";
import { createProjectsRepository } from "./projectsRepository";
import { createVideosRepository } from "./videosRepository";

const MIGRATIONS = join(import.meta.dirname, "../../drizzle");
let dir: string;
let db: Database;

beforeEach(async () => {
	dir = mkdtempSync(join(tmpdir(), "frameflow-db-"));
	db = await openDatabase(`file:${join(dir, "test.db")}`, MIGRATIONS);
});
afterEach(() => {
	db.$client.close();
	rmSync(dir, { recursive: true, force: true });
});

const style = {
	theme: { background: "#000000", text: "#FFFFFF", accent: "#FAC775", muted: "#888888" },
	fontFamily: "Montserrat",
	captions: { enabled: true, maxWordsPerPage: 4 },
};
const storyboardFor = (topic: string, withVoice = false) => {
	const script = starterScript(topic);
	return assembleStoryboard({
		script,
		language: "es",
		format: "9:16",
		style,
		voices: withVoice
			? script.scenes.map((_, i) => ({ src: `v${i}.wav`, duration: 3 }))
			: undefined,
	});
};

const setup = async () => {
	const project = await createProjectsRepository(db).create({
		name: "Astroinfo",
		presetId: "ciencia",
		languages: ["es"],
	});
	return { project, videos: createVideosRepository(db) };
};

describe("videosRepository", () => {
	it("crea un video con su variante y la versión 1, y lo lista", async () => {
		const { project, videos } = await setup();
		const created = await videos.create({
			projectId: project.id,
			topic: "agujeros negros",
			mode: "stepwise",
			status: "draft",
			storyboard: storyboardFor("agujeros negros"),
			source: "manual",
		});
		expect(created.versionNumber).toBe(1);
		expect(created.title).toBe("agujeros negros");
		expect(created.hasVoice).toBe(false);
		expect(created.render).toBeNull();

		const list = await videos.list(project.id);
		expect(list.map((v) => v.id)).toEqual([created.id]);
		expect(list[0]?.durationSec).toBeGreaterThan(0);
	});

	it("cada guardado crea una versión nueva y puede cambiar el estado", async () => {
		const { project, videos } = await setup();
		const v = await videos.create({
			projectId: project.id,
			topic: "luz",
			mode: "stepwise",
			status: "draft",
			storyboard: storyboardFor("luz"),
			source: "manual",
		});
		await videos.setStatus(v.id, "voicing");
		const saved = await videos.saveVersion(
			v.id,
			storyboardFor("luz", true),
			"voice",
			"ready_to_render",
		);
		expect(saved.versionNumber).toBe(2);
		expect(saved.status).toBe("ready_to_render");
		expect(saved.hasVoice).toBe(true);
		expect(saved.error).toBeNull();
	});

	it("registra renders ligados a la versión renderizada", async () => {
		const { project, videos } = await setup();
		const v = await videos.create({
			projectId: project.id,
			topic: "luz",
			mode: "stepwise",
			status: "ready_to_render",
			storyboard: storyboardFor("luz", true),
			source: "voice",
		});
		const render = await videos.createRender(v.id);
		await videos.finishRender(render.id, {
			ok: true,
			path: "/x/v1.mp4",
			sizeBytes: 1000,
			durationSec: 9.5,
			width: 1080,
			height: 1920,
		});
		await videos.saveVersion(v.id, storyboardFor("luz 2", true), "editor");
		const detail = await videos.get(v.id);
		expect(detail?.render).toMatchObject({ status: "done", path: "/x/v1.mp4", versionNumber: 1 });
		expect(detail?.versionNumber).toBe(2); // el MP4 quedó desactualizado
	});

	it("al arrancar recupera tareas interrumpidas", async () => {
		const { project, videos } = await setup();
		const v = await videos.create({
			projectId: project.id,
			topic: "luz",
			mode: "auto",
			status: "ready_to_render",
			storyboard: storyboardFor("luz", true),
			source: "voice",
		});
		await videos.createRender(v.id);
		await videos.setStatus(v.id, "rendering");
		expect(await videos.recoverInterrupted()).toBe(1);
		const detail = await videos.get(v.id);
		expect(detail?.status).toBe("ready_to_render");
		expect(detail?.error).toContain("interrumpió");
		expect(detail?.render?.status).toBe("failed");
	});
});

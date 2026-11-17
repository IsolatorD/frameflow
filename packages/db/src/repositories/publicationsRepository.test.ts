import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assembleStoryboard, starterScript } from "@frameflow/core/script";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Database, openDatabase } from "../client";
import { removeTempDir } from "../testing";
import { createProjectsRepository } from "./projectsRepository";
import { createPublicationsRepository } from "./publicationsRepository";
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
	removeTempDir(dir);
});

async function setup() {
	const project = await createProjectsRepository(db).create({
		name: "Astroinfo",
		presetId: "ciencia",
		languages: ["es"],
	});
	const videos = createVideosRepository(db);
	const video = await videos.create({
		projectId: project.id,
		topic: "luz",
		mode: "stepwise",
		status: "draft",
		storyboard: assembleStoryboard({
			script: starterScript("luz"),
			language: "es",
			format: "9:16",
			style: {
				theme: { background: "#000000", text: "#FFFFFF", accent: "#FAC775", muted: "#888888" },
				fontFamily: "Montserrat",
				captions: { enabled: true, maxWordsPerPage: 4 },
			},
		}),
		source: "manual",
	});
	const render = await videos.createRender(video.id);
	return { video, render, videos, publications: createPublicationsRepository(db) };
}

const post = { title: "Por qué la luz", caption: "Gancho\n\nSíguenos", hashtags: ["#luz"] };

describe("publicationsRepository", () => {
	it("guarda el borrador de cada red y lo actualiza sin duplicar", async () => {
		const { video, render, publications } = await setup();
		expect(await publications.list(video.id)).toEqual([]);
		await publications.saveDraft(video.id, "youtube", render.id, post);
		const saved = await publications.saveDraft(video.id, "youtube", render.id, {
			...post,
			caption: "Otro gancho",
		});
		await publications.saveDraft(video.id, "tiktok", render.id, { ...post, title: "" });
		expect(saved).toMatchObject({ platform: "youtube", status: "draft", exportedVersion: null });
		expect(saved.post.caption).toBe("Otro gancho");
		expect((await publications.list(video.id)).map((p) => p.platform).sort()).toEqual([
			"tiktok",
			"youtube",
		]);
		await expect(
			publications.saveDraft(video.id, "youtube", render.id, { ...post, hashtags: ["no válido"] }),
		).rejects.toThrow();
	});

	it("exportar, publicar (con enlace) y deshacer", async () => {
		const { video, render, videos, publications } = await setup();
		await publications.saveDraft(video.id, "instagram", render.id, post);
		const exported = await publications.markExported(video.id, "instagram", render.id, "/x/ig");
		expect(exported).toMatchObject({ status: "exported", exportPath: "/x/ig", exportedVersion: 1 });

		// Un MP4 nuevo de otra versión: al volver a exportar, la publicación apunta a él.
		await videos.saveVersion(video.id, (await videos.get(video.id))?.storyboard as never, "editor");
		const second = await videos.createRender(video.id);
		const again = await publications.markExported(video.id, "instagram", second.id, "/x/ig2");
		expect(again.exportedVersion).toBe(2);

		const published = await publications.markPublished(
			video.id,
			"instagram",
			"https://instagram.com/reel/abc",
		);
		expect(published).toMatchObject({ status: "published", url: "https://instagram.com/reel/abc" });
		expect(published.publishedAt).not.toBeNull();
		const undone = await publications.markPublished(video.id, "instagram", null);
		expect(undone).toMatchObject({ status: "exported", url: null, publishedAt: null });
	});
});

import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseFromNewerVersionError, openDatabase } from "./client";
import { removeTempDir } from "./testing";

const MIGRATIONS = join(import.meta.dirname, "../drizzle");
let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "frameflow-db-open-"));
});
afterEach(() => removeTempDir(dir));

/** Copia de las migraciones con solo las N primeras (simula una versión anterior de la app). */
function migrationsUpTo(count: number): string {
	const folder = join(dir, `migrations-${count}`);
	cpSync(MIGRATIONS, folder, { recursive: true });
	const journalPath = join(folder, "meta/_journal.json");
	const journal = JSON.parse(readFileSync(journalPath, "utf8"));
	journal.entries = journal.entries.slice(0, count);
	writeFileSync(journalPath, JSON.stringify(journal));
	return folder;
}

const url = () => `file:${join(dir, "frameflow.db")}`;

describe("abrir la base de datos", () => {
	it("una base nueva se crea sin copia de seguridad", async () => {
		const backups: string[] = [];
		const db = await openDatabase(url(), MIGRATIONS, { onBackup: (p) => backups.push(p) });
		db.$client.close();
		expect(backups).toEqual([]);
	});

	it("antes de migrar una base con datos hace una copia (y conserva las 5 últimas)", async () => {
		const old = await openDatabase(url(), migrationsUpTo(1));
		old.$client.close();
		// Copias antiguas de otras migraciones: deben quedar solo las 5 más recientes.
		const backupDir = join(dir, "backups");
		mkdirSync(backupDir);
		for (let i = 0; i < 6; i++) writeFileSync(join(backupDir, `frameflow-2000-0${i}-v1.db`), "");
		const backups: string[] = [];
		const db = await openDatabase(url(), MIGRATIONS, {
			backupDir,
			onBackup: (p) => backups.push(p),
		});
		db.$client.close();
		expect(backups).toHaveLength(1);
		expect(readdirSync(backupDir)).toHaveLength(5);
		expect(readdirSync(backupDir)).toContain(backups[0]?.split(/[\\/]/).pop());
		// La copia es una base de datos válida con el estado anterior (una sola migración).
		const copy = createClient({ url: `file:${backups[0]}` });
		const rows = await copy.execute("SELECT count(*) AS n FROM __drizzle_migrations");
		copy.close();
		expect(Number(rows.rows[0]?.n)).toBe(1);
	});

	it("la migración de publicaciones conserva las que ya había", async () => {
		const { createProjectsRepository } = await import("./repositories/projectsRepository");
		const { createVideosRepository } = await import("./repositories/videosRepository");
		const { assembleStoryboard, starterScript } = await import("@frameflow/core/script");
		// Base en la versión anterior (2 migraciones) con una publicación de una cuenta conectada.
		const old = await openDatabase(url(), migrationsUpTo(2));
		// El repositorio actual lee columnas de migraciones posteriores (p. ej. la sonoridad del
		// render, 0003): se añaden de forma temporal para preparar los datos y se quitan antes de migrar.
		await old.$client.execute("ALTER TABLE renders ADD loudness_lufs real");
		const project = await createProjectsRepository(old).create({
			name: "Astroinfo",
			presetId: "ciencia",
			languages: ["es"],
		});
		const videos = createVideosRepository(old);
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
		await old.$client.execute({
			sql: `INSERT INTO social_accounts (id, project_id, platform, external_id, handle, display_name, status, scopes, token_ref)
				VALUES ('acc', ?, 'youtube', 'ext', '@astro', 'Astro', 'connected', '[]', 'ref')`,
			args: [project.id],
		});
		await old.$client.execute({
			sql: `INSERT INTO publications (id, render_id, social_account_id, mode, title, hashtags)
				VALUES ('pub', ?, 'acc', 'api', 'Título', '["#luz"]')`,
			args: [render.id],
		});
		await old.$client.execute("ALTER TABLE renders DROP COLUMN loudness_lufs");
		old.$client.close();

		const db = await openDatabase(url(), MIGRATIONS);
		const rows = await db.$client.execute(
			"SELECT id, social_account_id, platform, title, hashtags FROM publications",
		);
		db.$client.close();
		expect(rows.rows).toHaveLength(1);
		expect(rows.rows[0]).toMatchObject({
			id: "pub",
			social_account_id: "acc",
			platform: null,
			title: "Título",
			hashtags: '["#luz"]',
		});
	});

	it("no toca una base creada por una versión más nueva", async () => {
		const db = await openDatabase(url(), MIGRATIONS);
		db.$client.close();
		await expect(openDatabase(url(), migrationsUpTo(1))).rejects.toBeInstanceOf(
			DatabaseFromNewerVersionError,
		);
	});
});

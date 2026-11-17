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

	it("no toca una base creada por una versión más nueva", async () => {
		const db = await openDatabase(url(), MIGRATIONS);
		db.$client.close();
		await expect(openDatabase(url(), migrationsUpTo(1))).rejects.toBeInstanceOf(
			DatabaseFromNewerVersionError,
		);
	});
});

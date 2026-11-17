import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { type Client, createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

/** La base de datos la creó una versión más nueva de Frameflow: esta no debe tocarla. */
export class DatabaseFromNewerVersionError extends Error {
	constructor() {
		super(
			"Tus datos son de una versión más nueva de Frameflow. Actualiza la app para abrirlos (no se ha modificado nada).",
		);
		this.name = "DatabaseFromNewerVersionError";
	}
}

/** Copias que se conservan antes de migrar (las más antiguas se borran). */
const KEEP_BACKUPS = 5;

export type OpenOptions = {
	/** Carpeta para la copia de seguridad previa a cada migración (por defecto, junto a la BD). */
	backupDir?: string;
	/** Se llama con la ruta de la copia hecha antes de migrar. */
	onBackup?: (path: string) => void;
};

/**
 * Abre (o crea) la base de datos y aplica las migraciones pendientes. Antes de migrar una base con
 * datos hace una copia de seguridad, y si la base viene de una versión más nueva no la toca.
 * `url`: "file:/ruta/frameflow.db". libsql usa N-API, así que el mismo binario funciona en Node
 * (tests) y en Electron sin recompilar.
 */
export async function openDatabase(
	url: string,
	migrationsFolder: string,
	options: OpenOptions = {},
): Promise<Database> {
	const client = createClient({ url });
	await client.execute("PRAGMA foreign_keys = ON");
	await client.execute("PRAGMA journal_mode = WAL");

	const known = knownMigrations(migrationsFolder);
	const applied = await appliedMigrations(client);
	const latestKnown = Math.max(0, ...known);
	if (applied.some((when) => when > latestKnown)) {
		client.close();
		throw new DatabaseFromNewerVersionError();
	}
	const latestApplied = Math.max(0, ...applied);
	const pending = known.some((when) => when > latestApplied);
	const file = url.replace(/^file:/, "");
	if (pending && applied.length > 0 && existsSync(file)) {
		const backupDir = options.backupDir ?? join(dirname(file), "backups");
		const path = await backup(client, backupDir, latestApplied);
		options.onBackup?.(path);
	}

	const db = drizzle(client, { schema });
	await migrate(db, { migrationsFolder });
	return db;
}

/** Fechas (ms) de las migraciones que trae esta versión, del _journal.json de Drizzle. */
function knownMigrations(migrationsFolder: string): number[] {
	const journal = JSON.parse(
		readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8"),
	) as {
		entries: { when: number }[];
	};
	return journal.entries.map((e) => e.when);
}

/** Fechas de las migraciones ya aplicadas (Drizzle las guarda en __drizzle_migrations). */
async function appliedMigrations(client: Client): Promise<number[]> {
	const table = await client.execute(
		"SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
	);
	if (table.rows.length === 0) return [];
	const rows = await client.execute("SELECT created_at FROM __drizzle_migrations");
	return rows.rows.map((r) => Number(r.created_at));
}

/** Copia consistente (VACUUM INTO) y limpieza de las copias antiguas. */
async function backup(client: Client, dir: string, version: number): Promise<string> {
	mkdirSync(dir, { recursive: true });
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const path = join(dir, `frameflow-${stamp}-v${version}.db`);
	await client.execute({ sql: "VACUUM INTO ?", args: [path] });
	const old = readdirSync(dir)
		.filter((f) => /^frameflow-.*\.db$/.test(f))
		.sort()
		.slice(0, -KEEP_BACKUPS);
	for (const f of old) rmSync(join(dir, f), { force: true });
	return path;
}

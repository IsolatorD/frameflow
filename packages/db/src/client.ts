import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Abre (o crea) la base de datos y aplica las migraciones pendientes.
 * `url`: "file:/ruta/frameflow.db". libsql usa N-API, así que el mismo binario
 * funciona en Node (tests) y en Electron sin recompilar.
 */
export async function openDatabase(url: string, migrationsFolder: string): Promise<Database> {
	const client = createClient({ url });
	await client.execute("PRAGMA foreign_keys = ON");
	await client.execute("PRAGMA journal_mode = WAL");
	const db = drizzle(client, { schema });
	await migrate(db, { migrationsFolder });
	return db;
}

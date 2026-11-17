import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Database, openDatabase } from "../client";
import { removeTempDir } from "../testing";
import { createProjectsRepository } from "./projectsRepository";

const MIGRATIONS = join(import.meta.dirname, "../../drizzle");

// Archivo temporal (no :memory:): las transacciones de libsql abren otra conexión.
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

describe("projectsRepository", () => {
	it("crea un proyecto con su BrandKit copiado del preset", async () => {
		const repo = createProjectsRepository(db);
		const created = await repo.create({
			name: "Astroinfo",
			description: "Astronomía y datos curiosos",
			presetId: "ciencia",
			languages: ["es", "en"],
		});

		expect(created.slug).toBe("astroinfo");
		expect(created.brandKit.voices.es?.voiceId).toBe("em_alex");

		const fetched = await repo.get(created.id);
		expect(fetched?.brandKit.theme.accent).toBe("#5DCAA5");
		expect(fetched?.languages).toEqual(["es", "en"]);
	});

	it("genera slugs únicos y lista del más nuevo al más viejo", async () => {
		const repo = createProjectsRepository(db);
		await repo.create({ name: "Astroinfo", presetId: "ciencia", languages: ["es"] });
		const second = await repo.create({ name: "Astroinfo", presetId: "ciencia", languages: ["es"] });
		expect(second.slug).toBe("astroinfo-2");

		const list = await repo.list();
		expect(list.map((p) => p.slug)).toEqual(["astroinfo-2", "astroinfo"]);
	});

	it("rechaza un preset inexistente sin dejar nada a medias", async () => {
		const repo = createProjectsRepository(db);
		await expect(
			repo.create({ name: "X proyecto", presetId: "no-existe", languages: ["es"] }),
		).rejects.toThrow("Preset desconocido");
		expect(await repo.list()).toEqual([]);
	});

	it("guarda el BrandKit editado y valida idiomas y colores", async () => {
		const repo = createProjectsRepository(db);
		const project = await repo.create({
			name: "Astroinfo",
			presetId: "ciencia",
			languages: ["es"],
		});
		const edited = {
			...project.brandKit,
			theme: { ...project.brandKit.theme, accent: "#FF6B6B" },
			tone: "Cercano y asombrado",
			defaultHashtags: ["#astronomía"],
		};

		await repo.updateBrandKit(project.id, edited);
		const fetched = await repo.get(project.id);
		expect(fetched?.brandKit.theme.accent).toBe("#FF6B6B");
		expect((await repo.list())[0]?.theme.accent).toBe("#FF6B6B"); // el listado usa la marca, no el preset
		expect(fetched?.brandKit.tone).toBe("Cercano y asombrado");

		await expect(repo.updateBrandKit(project.id, { ...edited, voices: {} })).rejects.toThrow(
			"Falta la voz para: es",
		);
		await expect(
			repo.updateBrandKit(project.id, { ...edited, theme: { ...edited.theme, text: "blanco" } }),
		).rejects.toThrow();
		await expect(repo.updateBrandKit(crypto.randomUUID(), edited)).rejects.toThrow("no existe");
		expect((await repo.get(project.id))?.brandKit.theme.text).toBe(project.brandKit.theme.text);
	});
});

import { findPreset } from "@frameflow/core/presets";
import {
	type BrandKit,
	brandKitFromPreset,
	brandKitSchema,
	type CreateProjectInput,
	createProjectInputSchema,
	type Project,
	type ProjectSummary,
	type ProjectWithBrand,
	slugify,
} from "@frameflow/core/project";
import { desc, eq, isNull, like, sql } from "drizzle-orm";
import type { Database } from "../client";
import { brandKits, projects } from "../schema";

type ProjectRow = typeof projects.$inferSelect;

const toProject = (row: ProjectRow): Project => ({ ...row });

export const createProjectsRepository = (db: Database) => ({
	async list(): Promise<ProjectSummary[]> {
		const rows = await db
			.select({ project: projects, brand: brandKits.data })
			.from(projects)
			.innerJoin(brandKits, eq(brandKits.projectId, projects.id))
			.where(isNull(projects.archivedAt))
			// rowid desempata si dos proyectos se crean en el mismo milisegundo
			.orderBy(desc(projects.createdAt), desc(sql`${projects}.rowid`));
		return rows.map(({ project, brand }) => ({ ...toProject(project), theme: brand.theme }));
	},

	async get(id: string): Promise<ProjectWithBrand | null> {
		const row = await db.query.projects.findFirst({ where: eq(projects.id, id) });
		if (!row) return null;
		const kit = await db.query.brandKits.findFirst({ where: eq(brandKits.projectId, id) });
		if (!kit) throw new Error(`El proyecto ${id} no tiene BrandKit`);
		return { ...toProject(row), brandKit: kit.data };
	},

	/** Crea el proyecto y su BrandKit (copiado del preset) en una sola transacción. */
	async create(input: CreateProjectInput): Promise<ProjectWithBrand> {
		const data = createProjectInputSchema.parse(input);
		const preset = findPreset(data.presetId);
		if (!preset) throw new Error(`Preset desconocido: ${data.presetId}`);

		const brandKit = brandKitFromPreset(preset, data.languages);
		const id = crypto.randomUUID();

		const row = await db.transaction(async (tx) => {
			// Slug único: astroinfo, astroinfo-2, astroinfo-3…
			const base = slugify(data.name) || "proyecto";
			const taken = new Set(
				(
					await tx
						.select({ slug: projects.slug })
						.from(projects)
						.where(like(projects.slug, `${base}%`))
				).map((r) => r.slug),
			);
			let slug = base;
			for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;

			const [inserted] = await tx
				.insert(projects)
				.values({
					id,
					name: data.name,
					slug,
					description: data.description,
					presetId: preset.id,
					languages: data.languages,
					defaultFormat: data.defaultFormat,
				})
				.returning();
			await tx.insert(brandKits).values({ projectId: id, data: brandKit });
			if (!inserted) throw new Error("No se pudo crear el proyecto");
			return inserted;
		});

		return { ...toProject(row), brandKit };
	},

	/** Reemplaza el BrandKit del proyecto. Exige una voz para cada idioma del proyecto. */
	async updateBrandKit(projectId: string, input: BrandKit): Promise<ProjectWithBrand> {
		const brandKit = brandKitSchema.parse(input);
		const row = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
		if (!row) throw new Error("Este proyecto no existe");
		const missing = row.languages.filter((lang) => !brandKit.voices[lang]);
		if (missing.length > 0) throw new Error(`Falta la voz para: ${missing.join(", ")}`);

		await db
			.update(brandKits)
			.set({ data: brandKit, updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` })
			.where(eq(brandKits.projectId, projectId));
		return { ...toProject(row), brandKit };
	},
});

export type ProjectsRepository = ReturnType<typeof createProjectsRepository>;

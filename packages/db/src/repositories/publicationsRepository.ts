import type { PlatformId } from "@frameflow/core/catalog";
import { type PostDraft, type PublicationView, postDraftSchema } from "@frameflow/core/publish";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Database } from "../client";
import { publications, renders, storyboardVersions, variants } from "../schema";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

/**
 * Publicaciones manuales (exportar y subir a mano): una por video y red. Guardan el texto editado,
 * la carpeta exportada y, cuando el usuario la pega, la dirección del post publicado.
 */
export function createPublicationsRepository(db: Database) {
	/** Renders de un video (por sus variantes). */
	const renderIdsOf = async (videoId: string) => {
		const rows = await db
			.select({ id: renders.id })
			.from(renders)
			.innerJoin(variants, eq(renders.variantId, variants.id))
			.where(eq(variants.videoId, videoId));
		return rows.map((r) => r.id);
	};

	const manualOf = async (videoId: string) => {
		const ids = await renderIdsOf(videoId);
		if (ids.length === 0) return [];
		return db
			.select({
				publication: publications,
				versionNumber: storyboardVersions.number,
			})
			.from(publications)
			.innerJoin(renders, eq(publications.renderId, renders.id))
			.innerJoin(storyboardVersions, eq(renders.storyboardVersionId, storyboardVersions.id))
			.where(
				and(
					inArray(publications.renderId, ids),
					eq(publications.mode, "manual"),
					isNull(publications.socialAccountId),
				),
			);
	};

	const toView = (row: Awaited<ReturnType<typeof manualOf>>[number]): PublicationView => {
		const p = row.publication;
		return {
			id: p.id,
			platform: p.platform as PlatformId,
			status:
				p.status === "published" ? "published" : p.status === "exported" ? "exported" : "draft",
			post: { title: p.title, caption: p.caption, hashtags: p.hashtags },
			exportPath: p.exportPath,
			exportedVersion: p.status === "draft" ? null : row.versionNumber,
			url: p.url,
			publishedAt: p.publishedAt,
			updatedAt: p.updatedAt,
		};
	};

	const find = async (videoId: string, platform: PlatformId) =>
		(await manualOf(videoId)).find((r) => r.publication.platform === platform) ?? null;

	return {
		async list(videoId: string): Promise<PublicationView[]> {
			return (await manualOf(videoId)).map(toView);
		},

		/** Guarda el texto editado (crea la publicación si no existe, ligada al render indicado). */
		async saveDraft(
			videoId: string,
			platform: PlatformId,
			renderId: string,
			input: PostDraft,
		): Promise<PublicationView> {
			const post = postDraftSchema.parse(input);
			const existing = await find(videoId, platform);
			if (existing) {
				await db
					.update(publications)
					.set({ ...post, updatedAt: now })
					.where(eq(publications.id, existing.publication.id));
			} else {
				await db.insert(publications).values({
					id: crypto.randomUUID(),
					renderId,
					platform,
					mode: "manual",
					status: "draft",
					...post,
					updatedAt: now,
				});
			}
			return toView(
				(await find(videoId, platform)) as NonNullable<Awaited<ReturnType<typeof find>>>,
			);
		},

		/** Marca como exportada con el render (MP4) que se copió y la carpeta resultante. */
		async markExported(
			videoId: string,
			platform: PlatformId,
			renderId: string,
			exportPath: string,
		): Promise<PublicationView> {
			const existing = await find(videoId, platform);
			if (!existing) throw new Error("Guarda primero el texto de la publicación");
			await db
				.update(publications)
				.set({
					renderId,
					exportPath,
					status: existing.publication.status === "published" ? "published" : "exported",
					updatedAt: now,
				})
				.where(eq(publications.id, existing.publication.id));
			return toView(
				(await find(videoId, platform)) as NonNullable<Awaited<ReturnType<typeof find>>>,
			);
		},

		/** El usuario la subió y pega el enlace (servirá para las estadísticas). null = deshacer. */
		async markPublished(
			videoId: string,
			platform: PlatformId,
			url: string | null,
		): Promise<PublicationView> {
			const existing = await find(videoId, platform);
			if (!existing) throw new Error("Esta publicación no existe");
			const published = url !== null;
			await db
				.update(publications)
				.set({
					url,
					status: published ? "published" : existing.publication.exportPath ? "exported" : "draft",
					publishedAt: published ? now : null,
					updatedAt: now,
				})
				.where(eq(publications.id, existing.publication.id));
			return toView(
				(await find(videoId, platform)) as NonNullable<Awaited<ReturnType<typeof find>>>,
			);
		},
	};
}

export type PublicationsRepository = ReturnType<typeof createPublicationsRepository>;

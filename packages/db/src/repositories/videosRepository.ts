import { isFullyVoiced, voicedSceneIds } from "@frameflow/core/script";
import type { Storyboard } from "@frameflow/core/storyboard";
import { storyboardSchema } from "@frameflow/core/storyboard";
import { storyboardDuration } from "@frameflow/core/storyboard/timeline";
import type {
	RenderInfo,
	VideoDetail,
	VideoMode,
	VideoStatus,
	VideoSummary,
} from "@frameflow/core/video";
import { and, desc, eq, inArray, max, sql } from "drizzle-orm";
import type { Database } from "../client";
import { renders, storyboardVersions, variants, videos } from "../schema";

type VersionSource = (typeof storyboardVersions.$inferInsert)["source"];
const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

/** "Con voz" = todas las escenas tienen su voz al día (requisito para renderizar). */
const hasVoice = (sb: Storyboard) => isFullyVoiced(sb);

/**
 * Videos de un proyecto. De momento cada video tiene una sola variante (idioma + formato);
 * cada cambio del storyboard crea una versión nueva y la variante apunta a la actual.
 */
export const createVideosRepository = (db: Database) => {
	const loadCurrent = async (videoId: string) => {
		const video = await db.query.videos.findFirst({ where: eq(videos.id, videoId) });
		if (!video) return null;
		const variant = await db.query.variants.findFirst({ where: eq(variants.videoId, videoId) });
		if (!variant?.currentVersionId) throw new Error(`El video ${videoId} no tiene versión actual`);
		const version = await db.query.storyboardVersions.findFirst({
			where: eq(storyboardVersions.id, variant.currentVersionId),
		});
		if (!version) throw new Error(`Falta la versión ${variant.currentVersionId}`);
		return { video, variant, version };
	};

	const toSummary = (
		video: typeof videos.$inferSelect,
		variant: typeof variants.$inferSelect,
		storyboard: Storyboard,
	): VideoSummary => ({
		id: video.id,
		projectId: video.projectId,
		title: video.title,
		topic: video.topic,
		mode: video.mode,
		status: video.status,
		language: variant.language,
		format: variant.format,
		durationSec: storyboardDuration(storyboard),
		createdAt: video.createdAt,
		updatedAt: video.updatedAt,
		error: video.error,
		hasVoice: hasVoice(storyboard),
	});

	return {
		async create(input: {
			projectId: string;
			topic: string;
			mode: VideoMode;
			status: VideoStatus;
			storyboard: Storyboard;
			source: VersionSource;
		}): Promise<VideoDetail> {
			const storyboard = storyboardSchema.parse(input.storyboard);
			const videoId = crypto.randomUUID();
			const variantId = crypto.randomUUID();
			const versionId = crypto.randomUUID();
			await db.transaction(async (tx) => {
				await tx.insert(videos).values({
					id: videoId,
					projectId: input.projectId,
					title: storyboard.title,
					topic: input.topic,
					mode: input.mode,
					status: input.status,
				});
				await tx.insert(variants).values({
					id: variantId,
					videoId,
					language: storyboard.language,
					format: storyboard.format,
				});
				await tx.insert(storyboardVersions).values({
					id: versionId,
					variantId,
					number: 1,
					storyboard,
					source: input.source,
				});
				await tx
					.update(variants)
					.set({ currentVersionId: versionId })
					.where(eq(variants.id, variantId));
			});
			const detail = await this.get(videoId);
			if (!detail) throw new Error("No se pudo crear el video");
			return detail;
		},

		async list(projectId: string): Promise<VideoSummary[]> {
			const rows = await db
				.select({ video: videos, variant: variants, storyboard: storyboardVersions.storyboard })
				.from(videos)
				.innerJoin(variants, eq(variants.videoId, videos.id))
				.innerJoin(storyboardVersions, eq(storyboardVersions.id, variants.currentVersionId))
				.where(and(eq(videos.projectId, projectId), sql`${videos.status} != 'archived'`))
				.orderBy(desc(videos.createdAt), desc(sql`${videos}.rowid`));
			return rows.map((r) => toSummary(r.video, r.variant, r.storyboard));
		},

		async get(videoId: string): Promise<VideoDetail | null> {
			const current = await loadCurrent(videoId);
			if (!current) return null;
			const { video, variant, version } = current;
			const render = await db
				.select({ render: renders, versionNumber: storyboardVersions.number })
				.from(renders)
				.innerJoin(storyboardVersions, eq(storyboardVersions.id, renders.storyboardVersionId))
				.where(eq(renders.variantId, variant.id))
				.orderBy(desc(sql`${renders}.rowid`))
				.limit(1);
			const last = render[0];
			const renderInfo: RenderInfo | null = last
				? {
						id: last.render.id,
						status: last.render.status,
						path: last.render.path,
						sizeBytes: last.render.sizeBytes,
						durationSec: last.render.durationSec,
						error: last.render.error,
						finishedAt: last.render.finishedAt,
						versionNumber: last.versionNumber,
					}
				: null;
			return {
				...toSummary(video, variant, version.storyboard),
				variantId: variant.id,
				versionNumber: version.number,
				storyboard: version.storyboard,
				render: renderInfo,
				voicedSceneIds: [...voicedSceneIds(version.storyboard)],
			};
		},

		/** Guarda un storyboard nuevo como versión siguiente y la marca como actual. */
		async saveVersion(
			videoId: string,
			storyboardInput: Storyboard,
			source: VersionSource,
			status?: VideoStatus,
		): Promise<VideoDetail> {
			const storyboard = storyboardSchema.parse(storyboardInput);
			const current = await loadCurrent(videoId);
			if (!current) throw new Error("Este video no existe");
			const { variant, version } = current;
			const [top] = await db
				.select({ n: max(storyboardVersions.number) })
				.from(storyboardVersions)
				.where(eq(storyboardVersions.variantId, variant.id));
			const id = crypto.randomUUID();
			await db.transaction(async (tx) => {
				await tx.insert(storyboardVersions).values({
					id,
					variantId: variant.id,
					number: (top?.n ?? 0) + 1,
					storyboard,
					source,
					parentId: version.id,
				});
				await tx.update(variants).set({ currentVersionId: id }).where(eq(variants.id, variant.id));
				await tx
					.update(videos)
					.set({
						title: storyboard.title,
						updatedAt: now,
						...(status ? { status, error: null } : {}),
					})
					.where(eq(videos.id, videoId));
			});
			const detail = await this.get(videoId);
			if (!detail) throw new Error("Este video no existe");
			return detail;
		},

		async setStatus(videoId: string, status: VideoStatus, error: string | null = null) {
			await db.update(videos).set({ status, error, updatedAt: now }).where(eq(videos.id, videoId));
		},

		/** Crea un render "en cola" para la versión actual del video. */
		async createRender(videoId: string): Promise<{ id: string; versionNumber: number }> {
			const current = await loadCurrent(videoId);
			if (!current) throw new Error("Este video no existe");
			const id = crypto.randomUUID();
			await db.insert(renders).values({
				id,
				variantId: current.variant.id,
				storyboardVersionId: current.version.id,
				status: "queued",
				startedAt: now,
			});
			return { id, versionNumber: current.version.number };
		},

		async finishRender(
			renderId: string,
			result:
				| {
						ok: true;
						path: string;
						sizeBytes: number;
						durationSec: number;
						width: number;
						height: number;
				  }
				| { ok: false; error: string },
		) {
			await db
				.update(renders)
				.set(
					result.ok
						? {
								status: "done",
								path: result.path,
								sizeBytes: result.sizeBytes,
								durationSec: result.durationSec,
								width: result.width,
								height: result.height,
								finishedAt: now,
							}
						: { status: "failed", error: result.error, finishedAt: now },
				)
				.where(eq(renders.id, renderId));
		},

		/**
		 * Al arrancar la app: las tareas que estaban en marcha cuando se cerró no van a terminar.
		 * Devuelve los videos a su último estado estable con un mensaje.
		 */
		async recoverInterrupted(): Promise<number> {
			const message = "Se interrumpió al cerrar la app. Vuelve a intentarlo.";
			const stuck = await db
				.select({ id: videos.id, status: videos.status })
				.from(videos)
				.where(inArray(videos.status, ["scripting", "voicing", "rendering"]));
			for (const v of stuck) {
				const back: VideoStatus = v.status === "rendering" ? "ready_to_render" : "draft";
				await this.setStatus(v.id, back, message);
			}
			await db
				.update(renders)
				.set({ status: "failed", error: message })
				.where(inArray(renders.status, ["queued", "rendering"]));
			return stuck.length;
		},
	};
};

export type VideosRepository = ReturnType<typeof createVideosRepository>;

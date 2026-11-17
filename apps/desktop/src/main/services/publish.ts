import { copyFileSync, existsSync, linkSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ConfiguredLlm } from "@frameflow/core/ai/providers";
import type { PlatformId } from "@frameflow/core/catalog";
import type { ProjectWithBrand } from "@frameflow/core/project";
import {
	aiPostsPrompt,
	aiPostsSchema,
	draftPost,
	exportNotes,
	fileSlug,
	type PostDraft,
	type PostSource,
	PUBLISH_TARGETS,
	postsFromAi,
	publishTarget,
} from "@frameflow/core/publish";
import { scriptFromStoryboard } from "@frameflow/core/script";
import type { VideoDetail } from "@frameflow/core/video";
import type { ProjectsRepository } from "@frameflow/db/projects";
import type { PublicationsRepository } from "@frameflow/db/publications";
import type { VideosRepository } from "@frameflow/db/videos";
import { shell } from "electron";
import { z } from "zod";
import type { PublishOverview } from "../../shared/api";
import { type RemotionSource, renderFrame } from "./render";

// Exportar para redes (fase 1): el texto de cada red, la carpeta lista para subir a mano (MP4,
// portada y texto) y el registro de lo publicado. Ver docs/07-exportar.md.

export type Publisher = ReturnType<typeof createPublisher>;

export function createPublisher(deps: {
	dataDir: string;
	projects: ProjectsRepository;
	videos: VideosRepository;
	publications: PublicationsRepository;
	remotion: RemotionSource;
	mediaBaseUrl: string;
	llm: () => Promise<ConfiguredLlm>;
}) {
	const load = async (videoId: string) => {
		const video = await deps.videos.get(videoId);
		if (!video) throw new Error("Este video no existe");
		const project = await deps.projects.get(video.projectId);
		if (!project) throw new Error("Este proyecto no existe");
		return { video, project };
	};

	const sourceOf = (video: VideoDetail, project: ProjectWithBrand): PostSource => ({
		title: video.storyboard.title,
		narrations: scriptFromStoryboard(video.storyboard).scenes.map((s) => s.narration),
		ctaText: project.brandKit.ctaText,
		hashtags: project.brandKit.defaultHashtags,
	});

	/** El MP4 actual (debe existir y estar terminado). */
	const renderOf = (video: VideoDetail) => {
		const render = video.render;
		if (render?.status !== "done" || !render.path || !existsSync(render.path))
			throw new Error("Primero crea el video (MP4) para poder exportarlo.");
		return render;
	};

	const overview = async (videoId: string): Promise<PublishOverview> => {
		const { video, project } = await load(videoId);
		const saved = await deps.publications.list(videoId);
		const source = sourceOf(video, project);
		return {
			items: PUBLISH_TARGETS.map((target) => {
				const publication = saved.find((p) => p.platform === target.id) ?? null;
				return {
					platform: target.id,
					post: publication?.post ?? draftPost(target, source),
					publication,
				};
			}),
		};
	};

	return {
		overview,

		/** Guarda el texto editado de una red. */
		async saveDraft(videoId: string, platform: PlatformId, post: PostDraft) {
			const { video } = await load(videoId);
			const render = renderOf(video);
			return deps.publications.saveDraft(videoId, platform, render.id, post);
		},

		/**
		 * Crea <proyecto>/exports/<video>/<red>/ con el MP4 (enlace duro si se puede: no ocupa más
		 * disco), la portada y el texto, y la marca como exportada.
		 */
		async export(videoId: string, platform: PlatformId, post: PostDraft) {
			const { video, project } = await load(videoId);
			const render = renderOf(video);
			const target = publishTarget(platform);
			await deps.publications.saveDraft(videoId, platform, render.id, post);
			const slug = fileSlug(video.storyboard.title);
			const base = join(deps.dataDir, "projects", project.slug, "exports", slug);
			const dir = join(base, platform);
			mkdirSync(dir, { recursive: true });

			const mp4 = join(dir, `${slug}.mp4`);
			rmSync(mp4, { force: true });
			try {
				linkSync(render.path as string, mp4);
			} catch {
				copyFileSync(render.path as string, mp4);
			}

			// Portada: un fotograma con el gancho en pantalla (la misma para todas las redes).
			const cover = join(base, `portada-v${render.versionNumber}.jpg`);
			if (!existsSync(cover)) {
				let first: { start: number; duration: number } | undefined;
				for (const track of video.storyboard.tracks)
					for (const clip of track.clips as readonly {
						type: string;
						start: number;
						duration: number;
					}[])
						if (clip.type === "scene" && (!first || clip.start < first.start)) first = clip;
				await renderFrame({
					source: deps.remotion,
					storyboard: video.storyboard,
					// Igual que el render del MP4: los medios del proyecto (voces, música, capas).
					mediaBaseUrl: `${deps.mediaBaseUrl}/projects/${project.slug}`,
					atSeconds: first ? first.start + Math.min(1.2, first.duration / 2) : 1,
					outputPath: cover,
				});
			}
			const coverCopy = join(dir, "portada.jpg");
			rmSync(coverCopy, { force: true });
			copyFileSync(cover, coverCopy);

			writeFileSync(join(dir, "texto.txt"), exportNotes(target, post));
			return deps.publications.markExported(videoId, platform, render.id, dir);
		},

		/** La IA elegida en Ajustes reescribe el texto de todas las redes (y se guarda). */
		async improveWithAi(videoId: string) {
			const { video, project } = await load(videoId);
			const render = renderOf(video);
			const llm = await deps.llm();
			const status = await llm.status();
			if (!status.available) throw new Error(status.reason);
			const messages = aiPostsPrompt({
				...sourceOf(video, project),
				language: video.language,
				channel: project.name,
			});
			let lastError = "";
			for (let attempt = 0; attempt < 2; attempt++) {
				const raw = await llm.generateJson(messages, z.toJSONSchema(aiPostsSchema), {
					think: false,
					temperature: 0.7,
				});
				try {
					const posts = postsFromAi(aiPostsSchema.parse(JSON.parse(raw)), {
						ctaText: project.brandKit.ctaText,
					});
					for (const target of PUBLISH_TARGETS) {
						const post = posts[target.id];
						if (post) await deps.publications.saveDraft(videoId, target.id, render.id, post);
					}
					return overview(videoId);
				} catch (error) {
					lastError = error instanceof Error ? error.message : String(error);
				}
			}
			throw new Error(`La IA no devolvió textos válidos: ${lastError}`);
		},

		markPublished: (videoId: string, platform: PlatformId, url: string | null) => {
			if (url !== null && !/^https?:\/\/\S+$/.test(url.trim()))
				throw new Error("Pega la dirección completa del post (empieza por https://).");
			return deps.publications.markPublished(videoId, platform, url?.trim() ?? null);
		},

		openUpload: (platform: PlatformId) => shell.openExternal(publishTarget(platform).uploadUrl),
		reveal: (path: string) => shell.showItemInFolder(path),
	};
}

import { copyFileSync, mkdirSync } from "node:fs";
import { basename, extname, join } from "node:path";
import type { ConfiguredLlm } from "@frameflow/core/ai/providers";
import type { ProjectWithBrand } from "@frameflow/core/project";
import { videoStyleFromBrandKit } from "@frameflow/core/project";
import {
	applyVideoSettings,
	assembleStoryboard,
	DEFAULT_MUSIC_VOLUME,
	isFullyVoiced,
	type SceneVoice,
	type Script,
	scriptFromStoryboard,
	scriptSchema,
	starterScript,
	type VideoSettings,
	voicedSceneIds,
} from "@frameflow/core/script";
import { generateScript, type LlmStatus } from "@frameflow/core/script/ai";
import {
	applyTimelineEdit,
	type CaptionEdit,
	type TimelineEdit,
	updateCaptions,
} from "@frameflow/core/script/edit";
import { applyOverlayOp, type OverlayOp } from "@frameflow/core/script/overlays";
import type { Storyboard } from "@frameflow/core/storyboard";
import {
	type CreateVideoInput,
	createVideoInputSchema,
	type JobEvent,
	type VideoDetail,
	type VideoStatus,
} from "@frameflow/core/video";
import type { ProjectsRepository } from "@frameflow/db/projects";
import type { VideosRepository } from "@frameflow/db/videos";
import { renderStoryboard } from "./render";
import { synthesize } from "./tts";

type Deps = {
	projects: ProjectsRepository;
	videos: VideosRepository;
	/** IA elegida en Ajustes en el momento de usarla. */
	llm: () => ConfiguredLlm;
	/** Carpeta de datos: los proyectos viven en <dataDir>/projects/<slug>/. */
	dataDir: string;
	ttsDir: string;
	rendererEntry: string;
	/** URL del servidor de medios que sirve <dataDir>. */
	mediaBaseUrl: string;
	emit: (event: JobEvent) => void;
};

/** Tras editar: con todas las voces al día se puede renderizar; si no, falta generar voz. */
const statusAfterEdit = (sb: Storyboard): VideoStatus =>
	isFullyVoiced(sb) ? "ready_to_render" : "draft";

/** "Mi Canción (final).mp3" → "mi-cancion-final.mp3". */
const safeFileName = (path: string) => {
	const ext = extname(path).toLowerCase();
	const name = basename(path, extname(path))
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
	return `${name || "archivo"}${ext}`;
};

export const MUSIC_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "ogg"];
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
export const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "m4v"];

/** Duración de un video con Remotion; si tarda o falla, sin duración (se usará 3 s). */
const videoDuration = async (path: string): Promise<number | undefined> => {
	try {
		const { getVideoMetadata } = await import("@remotion/renderer");
		const meta = await Promise.race([
			getVideoMetadata(path),
			new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
		]);
		return meta?.durationInSeconds ?? undefined;
	} catch {
		return undefined;
	}
};

/**
 * Orquesta el flujo de un video: guion (IA o manual) → voz → render.
 * Las tareas largas corren en segundo plano y avisan con `emit`; un video solo tiene una a la vez.
 */
export function createVideoPipeline(deps: Deps) {
	const running = new Map<string, AbortController>();

	const projectDir = (project: ProjectWithBrand) => join(deps.dataDir, "projects", project.slug);
	const loadProject = async (projectId: string) => {
		const project = await deps.projects.get(projectId);
		if (!project) throw new Error("Este proyecto no existe");
		return project;
	};
	const loadVideo = async (videoId: string) => {
		const video = await deps.videos.get(videoId);
		if (!video) throw new Error("Este video no existe");
		return video;
	};

	/** Ejecuta una tarea en segundo plano; si falla, vuelve al estado estable con el mensaje. */
	const runJob = (
		videoId: string,
		step: JobEvent["step"],
		task: (
			signal: AbortSignal,
			progress: (p: number | null, message: string) => void,
		) => Promise<void>,
	) => {
		if (running.has(videoId)) throw new Error("Este video ya tiene una tarea en marcha");
		const controller = new AbortController();
		running.set(videoId, controller);
		const progress = (p: number | null, message: string) =>
			deps.emit({ videoId, step, state: "running", progress: p, message });
		void task(controller.signal, progress)
			.then(() => deps.emit({ videoId, step, state: "done", progress: 1, message: "Listo" }))
			.catch(async (error: unknown) => {
				const message = controller.signal.aborted
					? "Cancelado"
					: error instanceof Error
						? error.message
						: String(error);
				console.error(`[pipeline:${step}]`, error);
				// Estado estable según lo que quedó guardado: con voz se puede renderizar; sin ella, no.
				const current = await deps.videos.get(videoId);
				const fallback: VideoStatus = current?.hasVoice ? "ready_to_render" : "draft";
				await deps.videos.setStatus(videoId, fallback, message);
				deps.emit({ videoId, step, state: "failed", progress: null, message });
			})
			.finally(() => running.delete(videoId));
	};

	const writeScript = async (
		video: VideoDetail,
		project: ProjectWithBrand,
		signal: AbortSignal,
		progress: (p: number | null, message: string) => void,
	) => {
		const script = await generateScript(deps.llm(), {
			topic: video.topic,
			tone: project.brandKit.tone,
			language: video.language,
			seconds: targetSeconds.get(video.id) ?? 60,
			channel: project.name,
			signal,
			onStage: (stage) =>
				progress(
					null,
					stage === "draft"
						? "La IA está pensando y escribiendo el guion (3–4 min)…"
						: "Revisando datos y estilo del guion…",
				),
		});
		const sb = assembleStoryboard({
			script,
			language: video.language,
			format: video.format,
			style: video.storyboard.style,
			previous: video.storyboard,
		});
		return deps.videos.saveVersion(video.id, sb, "ai", "draft");
	};

	const makeVoice = async (
		video: VideoDetail,
		project: ProjectWithBrand,
		signal: AbortSignal,
		progress: (p: number | null, message: string) => void,
	) => {
		const script = scriptFromStoryboard(video.storyboard);
		// Solo las escenas sin voz o cuya narración cambió: las demás conservan la suya.
		const voiced = voicedSceneIds(video.storyboard);
		const missing = script.scenes.filter((scene) => !voiced.has(scene.id ?? ""));
		if (missing.length === 0) {
			await deps.videos.setStatus(video.id, "ready_to_render");
			return video;
		}
		await deps.videos.setStatus(video.id, "voicing");
		const voice = project.brandKit.voices[video.language];
		if (!voice) throw new Error(`La marca no tiene voz para el idioma ${video.language}`);
		const relDir = join("videos", video.id, "voice");
		progress(null, "Preparando la voz (la primera vez descarga los modelos)…");
		const results = await synthesize(
			deps.ttsDir,
			{
				language: video.language,
				voiceId: voice.voiceId,
				speed: voice.speed,
				outDir: join(projectDir(project), relDir),
				items: missing.map((scene) => ({ id: scene.id ?? "", text: scene.narration })),
			},
			(done, total) =>
				progress(
					done / total,
					missing.length === script.scenes.length
						? `Voz de la escena ${done} de ${total}`
						: `Voz de las escenas cambiadas: ${done} de ${total}`,
				),
			signal,
		);
		const voices: Record<string, SceneVoice> = Object.fromEntries(
			results.map((r) => [
				r.id,
				{ src: `${relDir}/${r.file}`, duration: r.duration, words: r.words },
			]),
		);
		const sb = assembleStoryboard({
			script,
			language: video.language,
			format: video.format,
			style: video.storyboard.style,
			voices,
			previous: video.storyboard,
		});
		return deps.videos.saveVersion(video.id, sb, "voice", "ready_to_render");
	};

	const makeRender = async (
		video: VideoDetail,
		project: ProjectWithBrand,
		signal: AbortSignal,
		progress: (p: number | null, message: string) => void,
	) => {
		await deps.videos.setStatus(video.id, "rendering");
		const render = await deps.videos.createRender(video.id);
		const dir = join(projectDir(project), "videos", video.id, "renders");
		mkdirSync(dir, { recursive: true });
		const outputPath = join(dir, `v${render.versionNumber}.mp4`);
		try {
			const out = await renderStoryboard({
				entryPoint: deps.rendererEntry,
				storyboard: video.storyboard,
				mediaBaseUrl: `${deps.mediaBaseUrl}/projects/${project.slug}`,
				outputPath,
				signal,
				onProgress: (p, stage) => progress(p, stage),
			});
			await deps.videos.finishRender(render.id, { ok: true, path: outputPath, ...out });
			await deps.videos.setStatus(video.id, "ready");
		} catch (error) {
			await deps.videos.finishRender(render.id, {
				ok: false,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	};

	// Duración objetivo pedida al crear (solo la necesita la IA, no se guarda).
	const targetSeconds = new Map<string, number>();

	return {
		aiStatus: (): Promise<LlmStatus> => deps.llm().status(),

		isBusy: (videoId: string) => running.has(videoId),

		async create(input: CreateVideoInput): Promise<VideoDetail> {
			const data = createVideoInputSchema.parse(input);
			const project = await loadProject(data.projectId);
			if (!project.languages.includes(data.language as never)) {
				throw new Error("Ese idioma no está activado en el canal");
			}
			if (data.mode === "auto") {
				const status = await deps.llm().status();
				if (!status.available) throw new Error(`${status.reason} Usa el modo paso a paso.`);
			}
			const storyboard = assembleStoryboard({
				script: starterScript(data.topic),
				language: data.language,
				format: data.format,
				style: videoStyleFromBrandKit(project.brandKit),
				ctaText: project.brandKit.ctaText,
			});
			const video = await deps.videos.create({
				projectId: project.id,
				topic: data.topic,
				mode: data.mode,
				status: data.mode === "auto" ? "scripting" : "draft",
				storyboard,
				source: "manual",
			});
			if (data.mode === "auto") {
				targetSeconds.set(video.id, data.targetSeconds);
				// Automático: guion → voz → video, sin pararse a revisar.
				runJob(video.id, "script", async (signal, progress) => {
					const scripted = await writeScript(video, project, signal, progress);
					const voiced = await makeVoice(scripted, project, signal, progress);
					await makeRender(voiced, project, signal, progress);
				});
			}
			return video;
		},

		/**
		 * Guarda el guion editado (texto, orden y ajustes de cada escena).
		 * Las escenas cuya narración no cambió conservan su voz; las demás tendrán que regenerarla.
		 */
		async saveScript(videoId: string, input: Script): Promise<VideoDetail> {
			if (running.has(videoId)) throw new Error("Espera a que termine la tarea en marcha");
			const script = scriptSchema.parse(input);
			const video = await loadVideo(videoId);
			const sb = assembleStoryboard({
				script,
				language: video.language,
				format: video.format,
				style: video.storyboard.style,
				previous: video.storyboard,
			});
			return deps.videos.saveVersion(videoId, sb, "editor", statusAfterEdit(sb));
		},

		/** Subtítulos, llamada a la acción y música (no tocan el guion ni las voces). */
		async saveSettings(videoId: string, settings: VideoSettings): Promise<VideoDetail> {
			if (running.has(videoId)) throw new Error("Espera a que termine la tarea en marcha");
			const video = await loadVideo(videoId);
			const sb = applyVideoSettings(video.storyboard, settings);
			return deps.videos.saveVersion(videoId, sb, "editor", statusAfterEdit(sb));
		},

		/** Arrastrar o recortar en la línea de tiempo. */
		async editTimeline(videoId: string, edit: TimelineEdit): Promise<VideoDetail> {
			if (running.has(videoId)) throw new Error("Espera a que termine la tarea en marcha");
			const video = await loadVideo(videoId);
			const sb = applyTimelineEdit(video.storyboard, edit);
			return deps.videos.saveVersion(videoId, sb, "editor", statusAfterEdit(sb));
		},

		/** Corrige texto mostrado y tiempos de los subtítulos de una escena. */
		async saveCaptions(videoId: string, sceneId: string, words: CaptionEdit): Promise<VideoDetail> {
			if (running.has(videoId)) throw new Error("Espera a que termine la tarea en marcha");
			const video = await loadVideo(videoId);
			const sb = updateCaptions(video.storyboard, sceneId, words);
			return deps.videos.saveVersion(videoId, sb, "editor", statusAfterEdit(sb));
		},

		/** Vuelve a una versión anterior guardándola como versión nueva (nada se pierde). */
		async restoreVersion(videoId: string, number: number): Promise<VideoDetail> {
			if (running.has(videoId)) throw new Error("Espera a que termine la tarea en marcha");
			const sb = await deps.videos.getVersion(videoId, number);
			if (!sb) throw new Error(`No existe la versión ${number}`);
			return deps.videos.saveVersion(videoId, sb, "editor", statusAfterEdit(sb));
		},

		/** Capas libres: añadir, editar, mover, recortar, duplicar o borrar. */
		async editOverlays(
			videoId: string,
			op: OverlayOp,
		): Promise<{ video: VideoDetail; clipId: string | null }> {
			if (running.has(videoId)) throw new Error("Espera a que termine la tarea en marcha");
			const video = await loadVideo(videoId);
			const result = applyOverlayOp(video.storyboard, op);
			const saved = await deps.videos.saveVersion(
				videoId,
				result.storyboard,
				"editor",
				statusAfterEdit(result.storyboard),
			);
			return { video: saved, clipId: result.clipId };
		},

		/** Copia una imagen o un video a los recursos del proyecto (para añadirlo como capa). */
		async importMedia(
			videoId: string,
			sourcePath: string,
		): Promise<{ type: "image" | "video"; src: string; label: string; sourceDuration?: number }> {
			const ext = extname(sourcePath).slice(1).toLowerCase();
			const type = IMAGE_EXTENSIONS.includes(ext)
				? "image"
				: VIDEO_EXTENSIONS.includes(ext)
					? "video"
					: null;
			if (!type) throw new Error("Formato no admitido: usa PNG, JPG, WebP, MP4, MOV o WebM");
			const video = await loadVideo(videoId);
			const project = await loadProject(video.projectId);
			const relDir = join("assets", type === "image" ? "images" : "video");
			mkdirSync(join(projectDir(project), relDir), { recursive: true });
			const file = safeFileName(sourcePath);
			const target = join(projectDir(project), relDir, file);
			copyFileSync(sourcePath, target);
			return {
				type,
				src: `${relDir}/${file}`,
				label: basename(sourcePath),
				...(type === "video" ? { sourceDuration: await videoDuration(target) } : {}),
			};
		},

		/** Copia un archivo de música a los recursos del proyecto y lo devuelve listo para los ajustes. */
		async importMusic(
			videoId: string,
			sourcePath: string,
		): Promise<NonNullable<VideoSettings["music"]>> {
			const ext = extname(sourcePath).slice(1).toLowerCase();
			if (!MUSIC_EXTENSIONS.includes(ext)) throw new Error("Formato de audio no admitido");
			const video = await loadVideo(videoId);
			const project = await loadProject(video.projectId);
			const relDir = join("assets", "music");
			mkdirSync(join(projectDir(project), relDir), { recursive: true });
			const file = safeFileName(sourcePath);
			copyFileSync(sourcePath, join(projectDir(project), relDir, file));
			return {
				src: `${relDir}/${file}`,
				label: basename(sourcePath),
				volume: DEFAULT_MUSIC_VOLUME,
				fadeIn: 1,
				fadeOut: 2,
			};
		},

		async generateVoice(videoId: string): Promise<void> {
			const video = await loadVideo(videoId);
			const project = await loadProject(video.projectId);
			runJob(videoId, "voice", (signal, progress) =>
				makeVoice(video, project, signal, progress).then(() => undefined),
			);
		},

		async render(videoId: string): Promise<void> {
			const video = await loadVideo(videoId);
			if (!video.hasVoice) throw new Error("Genera la voz antes de crear el video");
			const project = await loadProject(video.projectId);
			runJob(videoId, "render", (signal, progress) => makeRender(video, project, signal, progress));
		},

		cancel(videoId: string) {
			running.get(videoId)?.abort();
		},

		mediaUrlFor: (project: ProjectWithBrand) => `${deps.mediaBaseUrl}/projects/${project.slug}`,
	};
}

export type VideoPipeline = ReturnType<typeof createVideoPipeline>;

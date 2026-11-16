import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ProjectWithBrand } from "@frameflow/core/project";
import { videoStyleFromBrandKit } from "@frameflow/core/project";
import {
	assembleStoryboard,
	type SceneVoice,
	type Script,
	scriptFromStoryboard,
	scriptSchema,
	starterScript,
} from "@frameflow/core/script";
import { generateScript, type LlmStatus, type OllamaProvider } from "@frameflow/core/script/ai";
import type { Storyboard } from "@frameflow/core/storyboard";
import { findClip } from "@frameflow/core/storyboard/timeline";
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
	llm: OllamaProvider;
	/** Carpeta de datos: los proyectos viven en <dataDir>/projects/<slug>/. */
	dataDir: string;
	ttsDir: string;
	rendererEntry: string;
	/** URL del servidor de medios que sirve <dataDir>. */
	mediaBaseUrl: string;
	emit: (event: JobEvent) => void;
};

/** Texto de la llamada a la acción que ya tiene el video (se conserva al rehacer el storyboard). */
const ctaOf = (sb: Storyboard): string | undefined => {
	const clip = findClip(sb, "cta")?.clip;
	return clip?.type === "text" ? clip.text : undefined;
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
		const script = await generateScript(deps.llm, {
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
			ctaText: ctaOf(video.storyboard),
		});
		return deps.videos.saveVersion(video.id, sb, "ai", "draft");
	};

	const makeVoice = async (
		video: VideoDetail,
		project: ProjectWithBrand,
		signal: AbortSignal,
		progress: (p: number | null, message: string) => void,
	) => {
		await deps.videos.setStatus(video.id, "voicing");
		const script = scriptFromStoryboard(video.storyboard);
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
				items: script.scenes.map((scene, i) => ({ id: String(i), text: scene.narration })),
			},
			(done, total) => progress(done / total, `Voz de la escena ${done} de ${total}`),
			signal,
		);
		const voices: SceneVoice[] = results.map((r) => ({
			src: `${relDir}/${r.file}`,
			duration: r.duration,
			words: r.words,
		}));
		const sb = assembleStoryboard({
			script,
			language: video.language,
			format: video.format,
			style: video.storyboard.style,
			ctaText: ctaOf(video.storyboard),
			voices,
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
		aiStatus: (): Promise<LlmStatus> => deps.llm.status(),

		isBusy: (videoId: string) => running.has(videoId),

		async create(input: CreateVideoInput): Promise<VideoDetail> {
			const data = createVideoInputSchema.parse(input);
			const project = await loadProject(data.projectId);
			if (!project.languages.includes(data.language as never)) {
				throw new Error("Ese idioma no está activado en el canal");
			}
			if (data.mode === "auto") {
				const status = await deps.llm.status();
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

		/** Modo paso a paso: guarda el guion editado. Cambiarlo invalida la voz (hay que regenerarla). */
		async saveScript(videoId: string, input: Script): Promise<VideoDetail> {
			if (running.has(videoId)) throw new Error("Espera a que termine la tarea en marcha");
			const script = scriptSchema.parse(input);
			const video = await loadVideo(videoId);
			const sb = assembleStoryboard({
				script,
				language: video.language,
				format: video.format,
				style: video.storyboard.style,
				ctaText: ctaOf(video.storyboard),
			});
			return deps.videos.saveVersion(videoId, sb, "manual", "draft");
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

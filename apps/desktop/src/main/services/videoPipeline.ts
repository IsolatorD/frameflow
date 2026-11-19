import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
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
import { reviewScript as reviewWithAi, type ScriptReview } from "@frameflow/core/script/review";
import { scriptTemplate } from "@frameflow/core/script/templates";
import type { Storyboard } from "@frameflow/core/storyboard";
import {
	type CreateVideoInput,
	createVideoInputSchema,
	type JobEvent,
	type VideoDetail,
	type VideoStatus,
} from "@frameflow/core/video";
import {
	alignWords,
	normalizeVolume,
	resample,
	trimSilence,
} from "@frameflow/core/voice/recording";
import { WHISPER_SAMPLE_RATE } from "@frameflow/core/voice/whisperModel";
import type { ProjectsRepository } from "@frameflow/db/projects";
import type { VideosRepository } from "@frameflow/db/videos";
import { type RemotionSource, renderStoryboard } from "./render";
import { ensureSfxFiles, usesSfx } from "./sfxFiles";
import { encodeWav, type VoiceEngine } from "./voice/kokoro";
import type { Whisper } from "./voice/whisper";

type Deps = {
	projects: ProjectsRepository;
	videos: VideosRepository;
	/** IA elegida en Ajustes en el momento de usarla. */
	llm: () => Promise<ConfiguredLlm>;
	/** Carpeta de datos: los proyectos viven en <dataDir>/projects/<slug>/. */
	dataDir: string;
	/** Voz (Kokoro en Node). */
	voice: VoiceEngine;
	/** Tiempos por palabra de la voz grabada. */
	whisper: Whisper;
	/** Composición de Remotion: código (desarrollo) o ya empaquetada (app instalada). */
	remotion: RemotionSource;
	/** URL del servidor de medios que sirve <dataDir>. */
	mediaBaseUrl: string;
	emit: (event: JobEvent) => void;
};

/** Frecuencia de las voces guardadas (la misma que Kokoro). */
const RECORDING_RATE = 24_000;

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
		const script = await generateScript(await deps.llm(), {
			topic: video.topic,
			tone: project.brandKit.tone,
			language: video.language,
			seconds: targetSeconds.get(video.id) ?? 60,
			template: templates.get(video.id),
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
		if (voice.engine === "recorded")
			throw new Error(
				"Este canal usa tu voz grabada: graba las escenas que faltan desde «Guion y escenas».",
			);
		const relDir = join("videos", video.id, "voice");
		progress(
			null,
			deps.voice.modelReady()
				? "Preparando la voz…"
				: "Preparando la voz (la primera vez descarga el modelo)…",
		);
		const results = await deps.voice.synthesize(
			{
				language: video.language,
				voiceId: voice.voiceId,
				speed: voice.speed,
				outDir: join(projectDir(project), relDir),
				items: missing.map((scene) => ({ id: scene.id ?? "", text: scene.narration })),
			},
			(event) => {
				if (event.kind === "download") {
					const { done, total } = event.progress;
					progress(
						total ? done / total : null,
						`Descargando el modelo de voz (solo la primera vez): ${formatMb(done)}${total ? ` de ${formatMb(total)}` : ""}`,
					);
				} else {
					progress(
						event.done / event.total,
						missing.length === script.scenes.length
							? `Voz de la escena ${event.done} de ${event.total}`
							: `Voz de las escenas cambiadas: ${event.done} de ${event.total}`,
					);
				}
			},
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
		if (usesSfx(video.storyboard)) ensureSfxFiles(projectDir(project));
		const render = await deps.videos.createRender(video.id);
		const dir = join(projectDir(project), "videos", video.id, "renders");
		mkdirSync(dir, { recursive: true });
		const outputPath = join(dir, `v${render.versionNumber}.mp4`);
		try {
			const out = await renderStoryboard({
				source: deps.remotion,
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

	// Revisiones de guion en marcha (no son tareas del video: no cambian su estado).
	const reviews = new Map<string, AbortController>();

	// Duración objetivo pedida al crear (solo la necesita la IA, no se guarda).
	const targetSeconds = new Map<string, number>();
	const templates = new Map<string, string>();

	return {
		aiStatus: async (): Promise<LlmStatus> => (await deps.llm()).status(),

		isBusy: (videoId: string) => running.has(videoId),

		/** ¿Hay algún video generándose? (no se reinicia para actualizar mientras tanto) */
		anyBusy: () => running.size > 0,

		async create(input: CreateVideoInput): Promise<VideoDetail> {
			const data = createVideoInputSchema.parse(input);
			const project = await loadProject(data.projectId);
			if (!project.languages.includes(data.language as never)) {
				throw new Error("Ese idioma no está activado en el canal");
			}
			if (data.mode === "auto") {
				const status = await (await deps.llm()).status();
				if (!status.available) throw new Error(`${status.reason} Usa el modo paso a paso.`);
			}
			const storyboard = assembleStoryboard({
				script: scriptTemplate(data.template).starter(data.topic),
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
				templates.set(video.id, data.template);
				// Automático: guion → voz → video, sin pararse a revisar.
				runJob(video.id, "script", async (signal, progress) => {
					const scripted = await writeScript(video, project, signal, progress);
					// Con voz grabada, el guion queda listo para que lo grabes tú.
					if (project.brandKit.voices[video.language]?.engine === "recorded") return;
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

		/**
		 * «Revisar guion»: la IA lee el guion guardado y devuelve un veredicto y propuestas. No guarda
		 * nada: las propuestas se aplican (o no) desde el editor, como una edición más.
		 */
		async reviewScript(videoId: string): Promise<ScriptReview> {
			if (reviews.has(videoId)) throw new Error("Ya se está revisando este guion");
			const video = await loadVideo(videoId);
			const project = await loadProject(video.projectId);
			const llm = await deps.llm();
			const status = await llm.status();
			if (!status.available) throw new Error(status.reason);
			const controller = new AbortController();
			reviews.set(videoId, controller);
			try {
				return await reviewWithAi(llm, scriptFromStoryboard(video.storyboard), {
					topic: video.topic,
					tone: project.brandKit.tone,
					language: video.language,
					channel: project.name,
					signal: controller.signal,
				});
			} catch (error) {
				if (controller.signal.aborted) throw new Error("Revisión cancelada");
				throw error;
			} finally {
				reviews.delete(videoId);
			}
		},

		cancelReview(videoId: string) {
			reviews.get(videoId)?.abort();
		},

		/** Subtítulos, llamada a la acción y música (no tocan el guion ni las voces). */
		async saveSettings(videoId: string, settings: VideoSettings): Promise<VideoDetail> {
			if (running.has(videoId)) throw new Error("Espera a que termine la tarea en marcha");
			const video = await loadVideo(videoId);
			const sb = applyVideoSettings(video.storyboard, settings);
			if (usesSfx(sb)) ensureSfxFiles(projectDir(await loadProject(video.projectId)));
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

		/**
		 * Voz grabada de una escena: se limpia (silencios, volumen), se guarda como WAV y Whisper dice
		 * cuándo se pronuncia cada palabra del guion (para los subtítulos). Solo cambia esa escena.
		 */
		async recordVoice(
			videoId: string,
			sceneId: string,
			pcm: Float32Array,
			sampleRate: number,
		): Promise<void> {
			const video = await loadVideo(videoId);
			const project = await loadProject(video.projectId);
			const scene = scriptFromStoryboard(video.storyboard).scenes.find((s) => s.id === sceneId);
			if (!scene) throw new Error("Esa escena ya no existe; guarda el guion y vuelve a grabar.");
			runJob(videoId, "voice", async (signal, progress) => {
				progress(null, "Limpiando la grabación…");
				const clean = normalizeVolume(
					trimSilence(resample(pcm, sampleRate, RECORDING_RATE), RECORDING_RATE),
				);
				if (clean.length < RECORDING_RATE * 0.3)
					throw new Error(
						"No se oye la voz en la grabación. Revisa el micrófono y vuelve a grabar.",
					);
				if (!deps.whisper.modelReady())
					progress(null, "Descargando el modelo de subtítulos (solo la primera vez)…");
				await deps.whisper.ensureModel(signal, ({ done, total }) =>
					progress(
						total ? done / total : null,
						`Descargando el modelo de subtítulos (solo la primera vez): ${formatMb(done)}${total ? ` de ${formatMb(total)}` : ""}`,
					),
				);
				progress(null, "Sincronizando los subtítulos con tu voz…");
				const seconds = clean.length / RECORDING_RATE;
				const heard = await deps.whisper.transcribe(
					resample(clean, RECORDING_RATE, WHISPER_SAMPLE_RATE),
					video.language,
				);
				signal.throwIfAborted();
				const relDir = join("videos", video.id, "voice");
				const dir = join(projectDir(project), relDir);
				mkdirSync(dir, { recursive: true });
				const file = `rec-${sceneId}-${Date.now().toString(36)}.wav`;
				writeFileSync(join(dir, file), encodeWav(clean, RECORDING_RATE));
				const current = await loadVideo(videoId);
				const sb = assembleStoryboard({
					script: scriptFromStoryboard(current.storyboard),
					language: current.language,
					format: current.format,
					style: current.storyboard.style,
					voices: {
						[sceneId]: {
							src: `${relDir}/${file}`,
							duration: Math.round(seconds * 1000) / 1000,
							words: alignWords(scene.narration, heard, seconds),
						},
					},
					previous: current.storyboard,
				});
				await deps.videos.saveVersion(videoId, sb, "voice", statusAfterEdit(sb));
			});
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

const formatMb = (bytes: number) => `${Math.round(bytes / 1024 ** 2)} MB`;

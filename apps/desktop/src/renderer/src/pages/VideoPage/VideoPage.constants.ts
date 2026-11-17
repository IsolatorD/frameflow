import { scriptFromStoryboard } from "@frameflow/core/script";
import { voiceClipOf } from "@frameflow/core/script/edit";
import type { Storyboard } from "@frameflow/core/storyboard";
import type { JobEvent, VideoDetail } from "@frameflow/core/video";
import type { Step } from "@frameflow/ui/src/molecules/StepIndicator/StepIndicatorInterface";
import type { CaptionScene } from "@frameflow/ui/src/organisms/CaptionEditor/CaptionEditorInterface";

export const BUSY_STATUSES = ["scripting", "voicing", "rendering"] as const;

export const isBusy = (video: VideoDetail) =>
	(BUSY_STATUSES as readonly string[]).includes(video.status);

/** ¿El último MP4 corresponde a la versión actual del storyboard? */
export const renderIsCurrent = (video: VideoDetail) =>
	video.render?.status === "done" && video.render.versionNumber === video.versionNumber;

export const videoSteps = (video: VideoDetail): Step[] => {
	const voiced = video.hasVoice;
	const rendered = renderIsCurrent(video);
	return [
		{ id: "script", label: "Guion", state: voiced ? "done" : "current" },
		{
			id: "voice",
			label: "Voz",
			state: voiced ? "done" : video.status === "voicing" ? "current" : "todo",
		},
		{ id: "render", label: "Video", state: rendered ? "done" : voiced ? "current" : "todo" },
	];
};

export const STEP_LABEL: Record<JobEvent["step"], string> = {
	script: "Guion",
	voice: "Voz",
	render: "Video",
};

export const BUSY_MESSAGE: Record<(typeof BUSY_STATUSES)[number], string> = {
	scripting: "La IA está escribiendo el guion…",
	voicing: "Generando la voz…",
	rendering: "Creando el video…",
};

export const formatBytes = (bytes: number) =>
	bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`;

/** "Generar voz" o, si ya hay voces, cuántas escenas faltan. */
export const voiceButtonLabel = (video: VideoDetail) => {
	const total = scriptFromStoryboard(video.storyboard).scenes.length;
	const missing = total - video.voicedSceneIds.length;
	if (video.voicedSceneIds.length === 0) return "Generar voz";
	return missing === 1 ? "Generar voz de 1 escena" : `Generar voz de ${missing} escenas`;
};

/** Escenas con voz al día y sus palabras, para el editor de subtítulos. */
export const captionScenesOf = (sb: Storyboard): CaptionScene[] =>
	scriptFromStoryboard(sb).scenes.flatMap((scene, i) => {
		const voice = scene.id ? voiceClipOf(sb, scene.id) : undefined;
		if (!scene.id || !voice?.words) return [];
		const preview = scene.narration.split(/\s+/).slice(0, 6).join(" ");
		return [
			{
				id: scene.id,
				label: `Escena ${i + 1} · ${preview}…`,
				voiceDuration: voice.duration,
				words: voice.words.map(({ text, start, end, display }) => ({ text, start, end, display })),
			},
		];
	});

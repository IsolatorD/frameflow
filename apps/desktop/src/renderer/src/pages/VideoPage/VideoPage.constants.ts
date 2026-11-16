import type { JobEvent, VideoDetail } from "@frameflow/core/video";
import type { Step } from "@frameflow/ui/src/molecules/StepIndicator/StepIndicatorInterface";

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

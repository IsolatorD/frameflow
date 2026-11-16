import type { VideoStatus, VideoSummary } from "@frameflow/core/video";
import type { BadgeTone } from "@frameflow/ui/src/atoms/Badge/BadgeInterface";
import type { VideoListItem } from "@frameflow/ui/src/organisms/VideoList/VideoListInterface";

export const VIDEO_STATUS: Record<VideoStatus, { label: string; tone: BadgeTone }> = {
	draft: { label: "Guion", tone: "neutral" },
	scripting: { label: "Escribiendo…", tone: "info" },
	voicing: { label: "Poniendo voz…", tone: "info" },
	ready_to_render: { label: "Con voz", tone: "neutral" },
	rendering: { label: "Renderizando…", tone: "info" },
	ready: { label: "Listo", tone: "success" },
	published: { label: "Publicado", tone: "success" },
	archived: { label: "Archivado", tone: "neutral" },
};

export const formatDuration = (seconds: number) => {
	const s = Math.round(seconds);
	return s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} min`;
};

const DATE = new Intl.DateTimeFormat("es", {
	day: "numeric",
	month: "short",
	hour: "2-digit",
	minute: "2-digit",
});

export const toVideoListItem = (video: VideoSummary): VideoListItem => ({
	id: video.id,
	title: video.title,
	subtitle: [
		formatDuration(video.durationSec),
		video.language.toUpperCase(),
		video.format,
		DATE.format(new Date(video.createdAt)),
	].join(" · "),
	status: video.error ? { label: "Con error", tone: "danger" } : VIDEO_STATUS[video.status],
});

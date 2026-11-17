import { PLATFORMS, type PlatformId } from "@frameflow/core/catalog";
import {
	checkPost,
	composeCaption,
	normalizeHashtag,
	type PostDraft,
	publishTarget,
} from "@frameflow/core/publish";
import type { VideoDetail } from "@frameflow/core/video";
import { EmptyState } from "@frameflow/ui/src/molecules/EmptyState/EmptyState";
import { PublishPanel } from "@frameflow/ui/src/organisms/PublishPanel/PublishPanel";
import type { PublishItem } from "@frameflow/ui/src/organisms/PublishPanel/PublishPanelInterface";
import { useEffect, useRef, useState } from "react";
import { useAiStatus } from "../../../hooks/useAiStatus/useAiStatus";
import { usePublish } from "../../../hooks/usePublish/usePublish";
import { publishService } from "../../../services/publishService/publishService";

const UPLOAD_LABEL: Record<PlatformId, string> = {
	youtube: "YouTube Studio",
	instagram: "Instagram",
	tiktok: "TikTok Studio",
	facebook: "Facebook",
};

const parseHashtags = (text: string) =>
	[
		...new Set(
			text
				.split(/[\s,]+/)
				.map(normalizeHashtag)
				.filter(Boolean),
		),
	] as string[];

/** Pestaña "Publicar": el texto de cada red y la carpeta lista para subir a mano. */
export function PublishSection({ video }: { video: VideoDetail }) {
	const render = video.render;
	const ready = render?.status === "done";
	const { overview, saveDraft, exportPost, improve, markPublished } = usePublish(video.id, ready);
	const ai = useAiStatus();
	const [active, setActive] = useState<PlatformId>("youtube");
	const [drafts, setDrafts] = useState<Partial<Record<PlatformId, PostDraft>>>({});
	const [copied, setCopied] = useState<string | null>(null);
	const timers = useRef<Partial<Record<PlatformId, ReturnType<typeof setTimeout>>>>({});

	// Al cargar (o tras "Mejorar con IA") los borradores vuelven a lo guardado.
	useEffect(() => {
		if (!overview.data) return;
		setDrafts(Object.fromEntries(overview.data.items.map((i) => [i.platform, i.post])));
	}, [overview.data]);

	if (!ready || !render) {
		return (
			<EmptyState
				title="Primero crea el video"
				description="Cuando tengas el MP4 aquí prepararás el texto de cada red y la carpeta para subirlo."
			/>
		);
	}
	if (!overview.data) {
		return (
			<p className="text-sm text-zinc-400">
				{overview.error ? overview.error.message : "Cargando…"}
			</p>
		);
	}

	const items: PublishItem[] = overview.data.items.map(({ platform, publication }) => {
		const target = publishTarget(platform);
		const post = drafts[platform] ?? { title: "", caption: "", hashtags: [] };
		return {
			id: platform,
			label: target.label,
			color: PLATFORMS.find((p) => p.id === platform)?.color ?? "#888",
			titleMax: target.title?.max ?? null,
			captionMax: target.caption.max,
			captionVisible: target.caption.visible,
			hashtagsRecommended: target.hashtags.recommended,
			note: target.note,
			uploadLabel: UPLOAD_LABEL[platform],
			post,
			composedLength: composeCaption(post).length,
			issues: checkPost(target, post, {
				seconds: render.durationSec ?? video.durationSec,
				format: video.format,
				renderUpToDate: render.versionNumber === video.versionNumber,
			}),
			status: publication?.status ?? "draft",
			exportPath: publication?.exportPath ?? null,
			exportOutdated:
				publication?.exportedVersion != null && publication.exportedVersion < render.versionNumber,
			url: publication?.url ?? null,
		};
	});

	const change = (id: string, post: PostDraft) => {
		const platform = id as PlatformId;
		setDrafts((d) => ({ ...d, [platform]: post }));
		clearTimeout(timers.current[platform]);
		timers.current[platform] = setTimeout(() => saveDraft.mutate({ platform, post }), 700);
	};
	const flush = (platform: PlatformId) => clearTimeout(timers.current[platform]);

	const error =
		exportPost.error?.message ??
		improve.error?.message ??
		markPublished.error?.message ??
		saveDraft.error?.message;

	return (
		<PublishPanel
			items={items}
			active={active}
			onActiveChange={(id) => setActive(id as PlatformId)}
			onChange={change}
			parseHashtags={parseHashtags}
			onCopy={(id) => {
				const post = drafts[id as PlatformId];
				if (!post) return;
				const text = post.title ? `${post.title}\n\n${composeCaption(post)}` : composeCaption(post);
				void navigator.clipboard.writeText(text).then(() => {
					setCopied("Texto copiado");
					setTimeout(() => setCopied(null), 2000);
				});
			}}
			onExport={(id) => {
				const platform = id as PlatformId;
				const post = drafts[platform];
				if (!post) return;
				flush(platform);
				exportPost.mutate({ platform, post });
			}}
			onOpenUpload={(id) => void publishService.openUpload(id as PlatformId)}
			onReveal={(path) => void publishService.reveal(path)}
			onMarkPublished={(id, url) => markPublished.mutate({ platform: id as PlatformId, url })}
			onImprove={() => improve.mutate()}
			exporting={exportPost.isPending ? (exportPost.variables?.platform ?? null) : null}
			improving={improve.isPending}
			aiAvailable={Boolean(ai.data?.available)}
			aiNote={
				ai.data
					? ai.data.available
						? `Usa ${ai.data.name}`
						: ai.data.reason
					: "Comprobando la IA…"
			}
			copied={copied}
			saving={saveDraft.isPending}
			error={error}
		/>
	);
}

import { formatLufs } from "@frameflow/core/audio/loudness";
import { DEFAULT_SFX_VOLUME } from "@frameflow/core/audio/sfx";
import {
	FREE_STYLE,
	resolveVisualStyle,
	VISUAL_STYLES,
	visualStyleLabel,
} from "@frameflow/core/look";
import { WORDS_PER_PAGE_RANGE } from "@frameflow/core/project";
import {
	EXTRA_TIME_RANGE,
	estimateSeconds,
	MUSIC_VOLUME_RANGE,
	scriptFromStoryboard,
	videoSettingsFromStoryboard,
} from "@frameflow/core/script";
import { updateOverlay } from "@frameflow/core/script/overlays";
import { KEYFRAME_TOLERANCE, setKeyframeEasing } from "@frameflow/core/storyboard/keyframes";
import { findClip } from "@frameflow/core/storyboard/timeline";
import { Badge } from "@frameflow/ui/src/atoms/Badge/Badge";
import { Button } from "@frameflow/ui/src/atoms/Button/Button";
import { ProgressBar } from "@frameflow/ui/src/atoms/ProgressBar/ProgressBar";
import { Dialog } from "@frameflow/ui/src/molecules/Dialog/Dialog";
import { EmptyState } from "@frameflow/ui/src/molecules/EmptyState/EmptyState";
import { Section } from "@frameflow/ui/src/molecules/Section/Section";
import { StepIndicator } from "@frameflow/ui/src/molecules/StepIndicator/StepIndicator";
import { Tabs } from "@frameflow/ui/src/molecules/Tabs/Tabs";
import { CaptionEditor } from "@frameflow/ui/src/organisms/CaptionEditor/CaptionEditor";
import type { OverlayDraft } from "@frameflow/ui/src/organisms/OverlayInspector/OverlayInspectorInterface";
import { ScriptEditor } from "@frameflow/ui/src/organisms/ScriptEditor/ScriptEditor";
import { VideoSettingsPanel } from "@frameflow/ui/src/organisms/VideoSettingsPanel/VideoSettingsPanel";
import { AppShell } from "@frameflow/ui/src/templates/AppShell/AppShell";
import type { PlayerRef } from "@remotion/player";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate, useParams } from "react-router";
import { UpdateBanner } from "../../components/UpdateBanner/UpdateBanner";
import { useJobEvents } from "../../hooks/useJobEvents/useJobEvents";
import { useMediaBaseUrl } from "../../hooks/useMediaBaseUrl/useMediaBaseUrl";
import { usePlayheadSeconds } from "../../hooks/usePlayheadSeconds/usePlayheadSeconds";
import { useProject } from "../../hooks/useProject/useProject";
import { useProjects } from "../../hooks/useProjects/useProjects";
import { useVersionHistory } from "../../hooks/useVersionHistory/useVersionHistory";
import { useVideo } from "../../hooks/useVideo/useVideo";
import { useVideoActions } from "../../hooks/useVideoActions/useVideoActions";
import { footerNav, projectsNavGroup } from "../../utils/navigation/navigation";
import { projectPath } from "../../utils/router/router";
import { formatDuration, VIDEO_STATUS } from "../../utils/videoStatus/videoStatus";
import { SECTIONS } from "../ProjectPage/ProjectPage.constants";
import { OverlaysSection } from "./OverlaysSection/OverlaysSection";
import {
	addKeyframeHere,
	draftToPatch,
	effectiveDraft,
	overlayDraftOf,
	removeKeyframeHere,
	toggleAnimation,
	writeBack,
} from "./OverlaysSection/OverlaysSection.constants";
import { PreviewOverlayEditor } from "./PreviewOverlayEditor/PreviewOverlayEditor";
import { PublishSection } from "./PublishSection/PublishSection";
import { RecordVoiceDialog } from "./RecordVoiceDialog/RecordVoiceDialog";
import { ScriptReviewSection } from "./ScriptReviewSection/ScriptReviewSection";
import { StoryboardPreview } from "./StoryboardPreview/StoryboardPreview";
import {
	BUSY_MESSAGE,
	captionScenesOf,
	formatBytes,
	isBusy,
	renderIsCurrent,
	STEP_LABEL,
	videoSteps,
	voiceButtonLabel,
} from "./VideoPage.constants";
import { VideoTimeline } from "./VideoTimeline/VideoTimeline";

/** Un video: guion editable a la izquierda; vista previa y pasos (voz, render) a la derecha. */
export function VideoPage() {
	const { projectId = "", videoId = "" } = useParams();
	const navigate = useNavigate();
	const projects = useProjects();
	const project = useProject(projectId);
	const video = useVideo(videoId);
	const media = useMediaBaseUrl();
	const actions = useVideoActions(videoId);
	const job = useJobEvents(videoId);
	const [scriptDirty, setScriptDirty] = useState(false);
	const [settingsDirty, setSettingsDirty] = useState(false);
	const [captionsDirty, setCaptionsDirty] = useState(false);
	const [overlayDraft, setOverlayDraft] = useState<{ clipId: string; draft: OverlayDraft } | null>(
		null,
	);
	const dirty = scriptDirty || settingsDirty || captionsDirty || overlayDraft !== null;
	const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
	const blocker = useBlocker(dirty);
	// Escena cuya voz se está grabando (diálogo abierto) o null.
	const [recordingSceneId, setRecordingSceneId] = useState<string | null>(null);
	const [tab, setTab] = useState<"script" | "settings" | "captions" | "layers" | "publish">(
		"script",
	);
	const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
	const [focusSceneId, setFocusSceneId] = useState<string | null>(null);
	const playerRef = useRef<PlayerRef>(null);
	const previewRef = useRef<HTMLDivElement>(null);
	// Elegir otra capa descarta el borrador de la anterior (si no, la vista previa lo seguiría mostrando).
	const selectOverlay = (clipId: string | null) => {
		setSelectedOverlayId(clipId);
		setSelectedClipId(clipId);
		setOverlayDraft((d) => (d && d.clipId !== clipId ? null : d));
	};

	// ── Capa seleccionada: borrador real (con fotogramas) y su versión en el instante del cabezal ──
	const fps = video.data?.storyboard.fps ?? 30;
	const overlayClip = (clipId: string | null) =>
		clipId && video.data ? (findClip(video.data.storyboard, clipId)?.clip ?? null) : null;
	const rawOverlayOf = (clipId: string): OverlayDraft | null =>
		overlayDraft?.clipId === clipId
			? overlayDraft.draft
			: video.data
				? overlayDraftOf(video.data.storyboard, clipId)
				: null;
	/** Segundo del cabezal dentro de una capa, leído ahora mismo del reproductor. */
	const liveClipTime = (clipId: string) => {
		const clip = overlayClip(clipId);
		const now = (playerRef.current?.getCurrentFrame() ?? 0) / fps;
		return clip
			? Math.round(Math.min(Math.max(now - clip.start, 0), clip.duration) * 100) / 100
			: 0;
	};
	const selectedClip = overlayClip(selectedOverlayId);
	const savedOverlay =
		selectedOverlayId && video.data
			? overlayDraftOf(video.data.storyboard, selectedOverlayId)
			: null;
	const rawOverlay = selectedOverlayId ? rawOverlayOf(selectedOverlayId) : null;
	const overlayAnimated = Boolean(rawOverlay?.keyframes?.length || savedOverlay?.keyframes?.length);
	const playheadSec = usePlayheadSeconds(playerRef, fps, tab === "layers" && overlayAnimated);
	const selectedTime = selectedClip
		? Math.min(Math.max(playheadSec - selectedClip.start, 0), selectedClip.duration)
		: 0;
	/** Fotograma bajo el cabezal en la capa seleccionada (los fotogramas ya vienen ordenados). */
	const currentKeyframe = rawOverlay?.keyframes?.find(
		(k) => Math.abs(k.at - selectedTime) < KEYFRAME_TOLERANCE,
	);
	const setRawOverlay = (clipId: string, draft: OverlayDraft) => {
		selectOverlay(clipId);
		setOverlayDraft({ clipId, draft });
	};
	const saveOverlay = (clipId: string, draft: OverlayDraft) =>
		actions.editOverlays
			.mutateAsync({ op: "update", clipId, patch: draftToPatch(draft) })
			.then(() => setOverlayDraft(null));

	const script = useMemo(
		() => (video.data ? scriptFromStoryboard(video.data.storyboard) : null),
		[video.data],
	);
	const settings = useMemo(() => {
		if (!video.data) return null;
		const value = videoSettingsFromStoryboard(video.data.storyboard);
		return { ...value, visualStyle: value.visualStyle ?? FREE_STYLE, sfx: value.sfx ?? null };
	}, [video.data]);
	// Memorizado: el editor de subtítulos reinicia su borrador cuando cambian las escenas.
	const captionScenes = useMemo(
		() => (video.data ? captionScenesOf(video.data.storyboard) : []),
		[video.data],
	);

	const history = useVersionHistory(videoId, video.data?.versionNumber, (n) =>
		actions.restoreVersion.mutateAsync(n),
	);
	const canEdit = Boolean(video.data && !isBusy(video.data) && !dirty);

	// La vista previa muestra el borrador del inspector de capas antes de aplicarlo.
	const previewStoryboard = useMemo(() => {
		if (!video.data) return null;
		if (!overlayDraft) return video.data.storyboard;
		try {
			return updateOverlay(
				video.data.storyboard,
				overlayDraft.clipId,
				draftToPatch(overlayDraft.draft),
			);
		} catch {
			return video.data.storyboard; // borrador aún no válido (p. ej. texto vacío)
		}
	}, [video.data, overlayDraft]);

	// ⌫ elimina y ⌘D duplica la capa seleccionada (fuera de los campos de texto).
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (!selectedOverlayId || !canEdit) return;
			const target = event.target as HTMLElement | null;
			if (target?.closest("input, textarea, select, [contenteditable]")) return;
			const del = event.key === "Backspace" || event.key === "Delete";
			const dup = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d";
			if (!del && !dup) return;
			event.preventDefault();
			actions.editOverlays
				.mutateAsync({ op: del ? "delete" : "duplicate", clipId: selectedOverlayId })
				.then((r) => {
					setSelectedOverlayId(r.clipId);
					setSelectedClipId(r.clipId);
				})
				.catch(() => undefined);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [selectedOverlayId, canEdit, actions.editOverlays]);

	// ⌘Z / ⇧⌘Z (Ctrl en Windows/Linux) fuera de los campos de texto, que tienen su propio deshacer.
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
			const target = event.target as HTMLElement | null;
			if (target?.closest("input, textarea, select, [contenteditable]")) return;
			if (!canEdit) return;
			event.preventDefault();
			if (event.shiftKey) history.redo();
			else history.undo();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [canEdit, history]);

	const nav = [
		projectsNavGroup(projects.data ?? [], navigate, projectId),
		{
			id: "sections",
			label: project.data?.name ?? "Proyecto",
			items: SECTIONS.map((s) => ({
				id: s.id,
				label: s.label,
				active: s.id === "library",
				badge: s.upcoming ? "Pronto" : undefined,
				onSelect: () => navigate(projectPath(projectId, s.id)),
			})),
		},
	];

	if (video.isPending || video.error || !video.data || !script || !settings) {
		const message = video.isPending
			? "Cargando…"
			: video.error
				? `No se pudo cargar el video: ${video.error.message}`
				: "Este video no existe.";
		return (
			<AppShell footer={footerNav(navigate)} notice={<UpdateBanner />} nav={nav} title="Video">
				<p role={video.isPending ? undefined : "alert"} className="text-sm text-zinc-400">
					{message}
				</p>
			</AppShell>
		);
	}

	const data = video.data;
	const busy = isBusy(data);
	// El canal usa voz grabada en este idioma: siempre se muestra qué escenas faltan por grabar.
	const recordsVoice = project.data?.brandKit.voices[data.language]?.engine === "recorded";
	const recordingIndex = script?.scenes.findIndex((s) => s.id === recordingSceneId) ?? -1;
	const recordingScene = recordingIndex >= 0 ? script?.scenes[recordingIndex] : undefined;
	const missingVoices = (script?.scenes.length ?? 0) - data.voicedSceneIds.length;
	const status = VIDEO_STATUS[data.status];
	const running = busy && job?.state === "running" ? job : null;
	const actionError =
		actions.generateVoice.error?.message ??
		actions.recordVoice.error?.message ??
		actions.render.error?.message ??
		actions.openRender.error?.message ??
		actions.editTimeline.error?.message ??
		actions.restoreVersion.error?.message;

	return (
		<AppShell
			footer={footerNav(navigate)}
			notice={<UpdateBanner />}
			nav={nav}
			eyebrow={project.data?.name}
			title={data.title}
			subtitle={data.topic !== data.title ? data.topic : undefined}
			actions={
				<div className="flex items-center gap-4">
					<div className="flex gap-1">
						<Button
							variant="ghost"
							aria-label="Deshacer"
							title={dirty ? "Guarda o descarta los cambios para deshacer" : "Deshacer (⌘Z)"}
							disabled={!history.canUndo || !canEdit || actions.restoreVersion.isPending}
							onClick={history.undo}
							className="px-2.5"
						>
							Deshacer
						</Button>
						<Button
							variant="ghost"
							aria-label="Rehacer"
							title={dirty ? "Guarda o descarta los cambios para rehacer" : "Rehacer (⇧⌘Z)"}
							disabled={!history.canRedo || !canEdit || actions.restoreVersion.isPending}
							onClick={history.redo}
							className="px-2.5"
						>
							Rehacer
						</Button>
					</div>
					<StepIndicator steps={videoSteps(data)} />
				</div>
			}
		>
			<div className="flex flex-col gap-4">
				{media.data && project.data && data.status !== "scripting" ? (
					<VideoTimeline
						storyboard={data.storyboard}
						voicedSceneIds={data.voicedSceneIds}
						playerRef={playerRef}
						selectedClipId={selectedClipId}
						onEdit={(action) =>
							action.kind === "timeline"
								? actions.editTimeline.mutate(action.edit)
								: actions.editOverlays.mutate(action.op)
						}
						disabled={!canEdit || actions.editTimeline.isPending || actions.editOverlays.isPending}
						onSelect={(clipId, target) => {
							setSelectedClipId(clipId);
							if (target.kind === "scene") {
								setTab("script");
								setFocusSceneId(target.sceneId);
							} else if (target.kind === "overlay") {
								setTab("layers");
								selectOverlay(target.clipId);
							} else setTab("settings");
						}}
					/>
				) : null}
				<div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-6">
					{data.status === "scripting" ? (
						<EmptyState
							title="La IA está escribiendo el guion"
							description="Con un modelo local suele tardar de 3 a 5 minutos (en la nube, segundos): primero razona y luego escribe. Después Frameflow pondrá la voz y creará el video; podrás editar el guion en cuanto esté listo."
						/>
					) : (
						<div className="flex min-w-0 flex-col gap-4">
							<Tabs
								label="Editar el video"
								idPrefix="video-edit"
								tabs={[
									{ id: "script", label: "Guion y escenas", badge: scriptDirty ? "●" : undefined },
									{
										id: "settings",
										label: "Ajustes del video",
										badge: settingsDirty ? "●" : undefined,
									},
									{ id: "captions", label: "Subtítulos", badge: captionsDirty ? "●" : undefined },
									{ id: "layers", label: "Capas", badge: overlayDraft ? "●" : undefined },
									{ id: "publish", label: "Publicar" },
								]}
								active={tab}
								onChange={(id) => setTab(id as typeof tab)}
							/>
							{/* Ambos paneles siguen montados para no perder el borrador al cambiar de pestaña. */}
							<div
								id="video-edit-panel-script"
								role="tabpanel"
								aria-labelledby="video-edit-tab-script"
								hidden={tab !== "script"}
								className="flex flex-col gap-4"
							>
								<ScriptReviewSection
									script={script}
									actions={actions}
									dirty={scriptDirty}
									busy={busy}
								/>
								<ScriptEditor
									value={script}
									estimateSeconds={estimateSeconds}
									onSave={(next) => actions.saveScript.mutate(next)}
									onDirtyChange={setScriptDirty}
									saving={actions.saveScript.isPending}
									serverError={actions.saveScript.error?.message}
									locked={busy}
									lockedReason={
										busy
											? "El video no se puede editar mientras se genera la voz o el video."
											: undefined
									}
									defaultTheme={data.storyboard.style.theme}
									extraTimeRange={EXTRA_TIME_RANGE}
									voicedSceneIds={
										data.voicedSceneIds.length > 0 || recordsVoice ? data.voicedSceneIds : undefined
									}
									recordedSceneIds={data.recordedSceneIds}
									onRecordScene={setRecordingSceneId}
									focusSceneId={focusSceneId}
								/>
							</div>
							<div
								id="video-edit-panel-settings"
								role="tabpanel"
								aria-labelledby="video-edit-tab-settings"
								hidden={tab !== "settings"}
							>
								<VideoSettingsPanel
									value={settings}
									onSave={(next) => actions.saveSettings.mutate(next)}
									onPickMusic={() => actions.pickMusic.mutateAsync()}
									visualStyles={VISUAL_STYLES}
									projectStyleLabel={
										project.data?.brandKit
											? visualStyleLabel(resolveVisualStyle(project.data.brandKit.visualStyle))
											: undefined
									}
									wordsPerPageRange={WORDS_PER_PAGE_RANGE}
									volumeRange={MUSIC_VOLUME_RANGE}
									defaultSfxVolume={DEFAULT_SFX_VOLUME}
									onDirtyChange={setSettingsDirty}
									saving={actions.saveSettings.isPending}
									serverError={actions.saveSettings.error?.message}
									locked={busy}
								/>
							</div>
							<div
								id="video-edit-panel-captions"
								role="tabpanel"
								aria-labelledby="video-edit-tab-captions"
								hidden={tab !== "captions"}
							>
								<CaptionEditor
									scenes={captionScenes}
									onSave={(sceneId, words) =>
										actions.saveCaptions.mutate({
											sceneId,
											words: words.map(({ start, end, display }) => ({ start, end, display })),
										})
									}
									onPlay={(sceneId, seconds) => {
										const start = findClip(data.storyboard, `voice-${sceneId}`)?.clip.start ?? 0;
										playerRef.current?.seekTo(Math.round((start + seconds) * data.storyboard.fps));
										playerRef.current?.play();
									}}
									onDirtyChange={setCaptionsDirty}
									saving={actions.saveCaptions.isPending}
									serverError={actions.saveCaptions.error?.message}
									locked={busy}
								/>
							</div>
							<div
								id="video-edit-panel-layers"
								role="tabpanel"
								aria-labelledby="video-edit-tab-layers"
								hidden={tab !== "layers"}
							>
								<OverlaysSection
									storyboard={data.storyboard}
									selectedId={selectedOverlayId}
									onSelect={selectOverlay}
									playhead={() => (playerRef.current?.getCurrentFrame() ?? 0) / data.storyboard.fps}
									editOverlays={(op) => actions.editOverlays.mutateAsync(op)}
									pickMedia={() => actions.pickMedia.mutateAsync()}
									value={savedOverlay ? effectiveDraft(savedOverlay, selectedTime) : null}
									draft={
										overlayDraft && overlayDraft.clipId === selectedOverlayId
											? effectiveDraft(overlayDraft.draft, selectedTime)
											: null
									}
									onDraftChange={(next) => {
										if (!selectedOverlayId || !rawOverlay) return;
										if (!next) setOverlayDraft(null);
										else
											setRawOverlay(
												selectedOverlayId,
												writeBack(rawOverlay, next, liveClipTime(selectedOverlayId)),
											);
									}}
									applyDraft={() =>
										selectedOverlayId && overlayDraft?.clipId === selectedOverlayId
											? saveOverlay(selectedOverlayId, overlayDraft.draft)
											: Promise.resolve()
									}
									animation={
										selectedOverlayId && rawOverlay && selectedClip
											? {
													enabled: Boolean(rawOverlay.keyframes?.length),
													time: selectedTime,
													inside:
														playheadSec >= selectedClip.start &&
														playheadSec < selectedClip.start + selectedClip.duration,
													keyframes: (rawOverlay.keyframes ?? []).map((k) => ({
														at: k.at,
														current: Math.abs(k.at - selectedTime) < KEYFRAME_TOLERANCE,
													})),
													current: currentKeyframe
														? {
																easing: currentKeyframe.easing,
																first: currentKeyframe.at === rawOverlay.keyframes?.[0]?.at,
															}
														: null,
													onEasingChange: (easing) =>
														currentKeyframe &&
														setRawOverlay(selectedOverlayId, {
															...rawOverlay,
															keyframes: setKeyframeEasing(
																rawOverlay.keyframes ?? [],
																currentKeyframe.at,
																easing,
															),
														}),
													onToggle: (on) =>
														setRawOverlay(
															selectedOverlayId,
															toggleAnimation(rawOverlay, on, liveClipTime(selectedOverlayId)),
														),
													onAddHere: () =>
														setRawOverlay(
															selectedOverlayId,
															addKeyframeHere(rawOverlay, liveClipTime(selectedOverlayId)),
														),
													onRemoveHere: () =>
														setRawOverlay(
															selectedOverlayId,
															removeKeyframeHere(rawOverlay, liveClipTime(selectedOverlayId)),
														),
													onSeek: (at) =>
														playerRef.current?.seekTo(Math.round((selectedClip.start + at) * fps)),
												}
											: undefined
									}
									saving={actions.editOverlays.isPending}
									error={actions.editOverlays.error?.message ?? actions.pickMedia.error?.message}
									locked={busy}
								/>
							</div>
							<div
								id="video-edit-panel-publish"
								role="tabpanel"
								aria-labelledby="video-edit-tab-publish"
								hidden={tab !== "publish"}
							>
								{tab === "publish" ? <PublishSection video={data} /> : null}
							</div>
						</div>
					)}

					<aside className="sticky top-0 flex flex-col gap-4">
						{media.data && project.data && data.status !== "scripting" ? (
							<div ref={previewRef} className="relative">
								<StoryboardPreview
									storyboard={previewStoryboard ?? data.storyboard}
									mediaBaseUrl={`${media.data}/projects/${project.data.slug}`}
									playerRef={playerRef}
								/>
								{tab === "layers" ? (
									<PreviewOverlayEditor
										storyboard={previewStoryboard ?? data.storyboard}
										containerRef={previewRef}
										playerRef={playerRef}
										selectedId={selectedOverlayId}
										onSelect={selectOverlay}
										baseDraft={(clipId) => {
											const raw = rawOverlayOf(clipId);
											return raw ? effectiveDraft(raw, liveClipTime(clipId)) : null;
										}}
										onDraftChange={(clipId, edited) => {
											const raw = rawOverlayOf(clipId);
											if (raw) setRawOverlay(clipId, writeBack(raw, edited, liveClipTime(clipId)));
										}}
										onCommit={(clipId, edited) => {
											const raw = rawOverlayOf(clipId);
											if (raw)
												void saveOverlay(
													clipId,
													writeBack(raw, edited, liveClipTime(clipId)),
												).catch(() => undefined);
										}}
										disabled={
											busy ||
											scriptDirty ||
											settingsDirty ||
											captionsDirty ||
											actions.editOverlays.isPending
										}
									/>
								) : null}
							</div>
						) : null}

						<Section
							title="Estado"
							action={
								<Badge tone={data.error ? "danger" : status.tone}>
									{data.error ? "Con error" : status.label}
								</Badge>
							}
						>
							<div className="flex flex-col gap-3 text-sm">
								<p className="text-xs text-zinc-500">
									{formatDuration(data.durationSec)} · versión {data.versionNumber}
									{data.hasVoice ? " · con voz" : " · sin voz"}
								</p>

								{busy ? (
									<>
										<ProgressBar
											value={running?.progress ?? null}
											label={
												running
													? `${STEP_LABEL[running.step]}: ${running.message}`
													: BUSY_MESSAGE[data.status as keyof typeof BUSY_MESSAGE]
											}
										/>
										<Button variant="ghost" onClick={() => actions.cancel.mutate()}>
											Cancelar
										</Button>
									</>
								) : (
									<>
										{data.error ? (
											<p
												role="alert"
												className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-400/30"
											>
												{data.error}
											</p>
										) : null}
										{actionError ? (
											<p role="alert" className="text-xs text-red-400">
												{actionError}
											</p>
										) : null}
										{data.hasVoice ? (
											<p className="text-xs text-emerald-300">✓ Voz al día en todas las escenas</p>
										) : recordsVoice ? (
											<p className="text-xs text-zinc-400">
												🎙 Faltan {missingVoices} {missingVoices === 1 ? "escena" : "escenas"} por
												grabar: usa «Grabar» en cada escena.
											</p>
										) : (
											<Button
												disabled={dirty}
												loading={actions.generateVoice.isPending}
												onClick={() => actions.generateVoice.mutate()}
											>
												{voiceButtonLabel(data)}
											</Button>
										)}
										<Button
											variant={data.hasVoice && !renderIsCurrent(data) ? "primary" : "secondary"}
											disabled={!data.hasVoice || dirty}
											loading={actions.render.isPending}
											onClick={() => actions.render.mutate()}
										>
											{renderIsCurrent(data) ? "Volver a crear el video" : "Crear video (MP4)"}
										</Button>
										{dirty ? (
											<p className="text-xs text-zinc-500">
												Guarda los cambios para generar la voz o el video.
											</p>
										) : !data.hasVoice ? (
											<p className="text-xs text-zinc-500">
												{data.voicedSceneIds.length > 0
													? "Solo se generará la voz de las escenas nuevas o cambiadas."
													: "La vista previa usa duraciones estimadas hasta que generes la voz."}
											</p>
										) : null}
									</>
								)}

								{data.render?.status === "done" && data.render.path ? (
									<div className="flex flex-col gap-2 border-t border-white/5 pt-3">
										<p className="text-xs text-zinc-400">
											MP4 de la versión {data.render.versionNumber}
											{data.render.sizeBytes ? ` · ${formatBytes(data.render.sizeBytes)}` : ""}
											{data.render.loudnessLufs !== null
												? ` · volumen ${formatLufs(data.render.loudnessLufs)}`
												: ""}
											{renderIsCurrent(data) ? "" : " (desactualizado)"}
										</p>
										<div className="flex gap-2">
											<Button variant="secondary" onClick={() => actions.openRender.mutate("open")}>
												Ver video
											</Button>
											<Button variant="ghost" onClick={() => actions.openRender.mutate("reveal")}>
												Mostrar en Finder
											</Button>
										</div>
									</div>
								) : null}
							</div>
						</Section>
					</aside>
				</div>
			</div>
			{recordingScene?.id ? (
				<RecordVoiceDialog
					index={recordingIndex}
					narration={recordingScene.narration}
					estimate={`${estimateSeconds(recordingScene.narration).toFixed(1).replace(".", ",")} s`}
					onUse={(take) =>
						actions.recordVoice.mutate(
							{ sceneId: recordingScene.id as string, ...take },
							{ onSuccess: () => setRecordingSceneId(null) },
						)
					}
					onClose={() => {
						actions.recordVoice.reset();
						setRecordingSceneId(null);
					}}
					using={actions.recordVoice.isPending}
					error={actions.recordVoice.error?.message}
				/>
			) : null}
			{blocker.state === "blocked" ? (
				<Dialog
					title="Tienes cambios sin guardar"
					description="Si sales ahora, se perderán los cambios sin guardar del video."
					onClose={() => blocker.reset()}
				>
					<div className="flex justify-end gap-2">
						<Button variant="ghost" onClick={() => blocker.proceed()}>
							Salir sin guardar
						</Button>
						<Button onClick={() => blocker.reset()}>Seguir editando</Button>
					</div>
				</Dialog>
			) : null}
		</AppShell>
	);
}

import { WORDS_PER_PAGE_RANGE } from "@frameflow/core/project";
import {
	EXTRA_TIME_RANGE,
	estimateSeconds,
	MUSIC_VOLUME_RANGE,
	scriptFromStoryboard,
	videoSettingsFromStoryboard,
} from "@frameflow/core/script";
import { Badge } from "@frameflow/ui/src/atoms/Badge/Badge";
import { Button } from "@frameflow/ui/src/atoms/Button/Button";
import { ProgressBar } from "@frameflow/ui/src/atoms/ProgressBar/ProgressBar";
import { Dialog } from "@frameflow/ui/src/molecules/Dialog/Dialog";
import { EmptyState } from "@frameflow/ui/src/molecules/EmptyState/EmptyState";
import { Section } from "@frameflow/ui/src/molecules/Section/Section";
import { StepIndicator } from "@frameflow/ui/src/molecules/StepIndicator/StepIndicator";
import { Tabs } from "@frameflow/ui/src/molecules/Tabs/Tabs";
import { ScriptEditor } from "@frameflow/ui/src/organisms/ScriptEditor/ScriptEditor";
import { VideoSettingsPanel } from "@frameflow/ui/src/organisms/VideoSettingsPanel/VideoSettingsPanel";
import { AppShell } from "@frameflow/ui/src/templates/AppShell/AppShell";
import type { PlayerRef } from "@remotion/player";
import { useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate, useParams } from "react-router";
import { useJobEvents } from "../../hooks/useJobEvents/useJobEvents";
import { useMediaBaseUrl } from "../../hooks/useMediaBaseUrl/useMediaBaseUrl";
import { useProject } from "../../hooks/useProject/useProject";
import { useProjects } from "../../hooks/useProjects/useProjects";
import { useVideo } from "../../hooks/useVideo/useVideo";
import { useVideoActions } from "../../hooks/useVideoActions/useVideoActions";
import { projectsNavGroup } from "../../utils/navigation/navigation";
import { projectPath } from "../../utils/router/router";
import { formatDuration, VIDEO_STATUS } from "../../utils/videoStatus/videoStatus";
import { SECTIONS } from "../ProjectPage/ProjectPage.constants";
import { StoryboardPreview } from "./StoryboardPreview/StoryboardPreview";
import {
	BUSY_MESSAGE,
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
	const dirty = scriptDirty || settingsDirty;
	const blocker = useBlocker(dirty);
	const [tab, setTab] = useState<"script" | "settings">("script");
	const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
	const [focusSceneId, setFocusSceneId] = useState<string | null>(null);
	const playerRef = useRef<PlayerRef>(null);

	const script = useMemo(
		() => (video.data ? scriptFromStoryboard(video.data.storyboard) : null),
		[video.data],
	);
	const settings = useMemo(
		() => (video.data ? videoSettingsFromStoryboard(video.data.storyboard) : null),
		[video.data],
	);

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
			<AppShell nav={nav} title="Video">
				<p role={video.isPending ? undefined : "alert"} className="text-sm text-zinc-400">
					{message}
				</p>
			</AppShell>
		);
	}

	const data = video.data;
	const busy = isBusy(data);
	const status = VIDEO_STATUS[data.status];
	const running = busy && job?.state === "running" ? job : null;
	const actionError =
		actions.generateVoice.error?.message ??
		actions.render.error?.message ??
		actions.openRender.error?.message;

	return (
		<AppShell
			nav={nav}
			eyebrow={project.data?.name}
			title={data.title}
			subtitle={data.topic !== data.title ? data.topic : undefined}
			actions={<StepIndicator steps={videoSteps(data)} />}
		>
			<div className="flex flex-col gap-4">
				{media.data && project.data && data.status !== "scripting" ? (
					<VideoTimeline
						storyboard={data.storyboard}
						voicedSceneIds={data.voicedSceneIds}
						playerRef={playerRef}
						selectedClipId={selectedClipId}
						onSelect={(clipId, target) => {
							setSelectedClipId(clipId);
							if (target.kind === "scene") {
								setTab("script");
								setFocusSceneId(target.sceneId);
							} else setTab("settings");
						}}
					/>
				) : null}
				<div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-6">
					{data.status === "scripting" ? (
						<EmptyState
							title="La IA está escribiendo el guion"
							description="Con el modelo local suele tardar de 3 a 4 minutos: primero razona y luego escribe. Después Frameflow pondrá la voz y creará el video; podrás editar el guion en cuanto esté listo."
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
							>
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
									voicedSceneIds={data.voicedSceneIds.length > 0 ? data.voicedSceneIds : undefined}
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
									wordsPerPageRange={WORDS_PER_PAGE_RANGE}
									volumeRange={MUSIC_VOLUME_RANGE}
									onDirtyChange={setSettingsDirty}
									saving={actions.saveSettings.isPending}
									serverError={actions.saveSettings.error?.message}
									locked={busy}
								/>
							</div>
						</div>
					)}

					<aside className="sticky top-0 flex flex-col gap-4">
						{media.data && project.data && data.status !== "scripting" ? (
							<StoryboardPreview
								storyboard={data.storyboard}
								mediaBaseUrl={`${media.data}/projects/${project.data.slug}`}
								playerRef={playerRef}
							/>
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

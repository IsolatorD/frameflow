import { useEffect, useState } from "react";
import { Button } from "../../atoms/Button/Button";
import { SelectField } from "../../atoms/SelectField/SelectField";
import { EmptyState } from "../../molecules/EmptyState/EmptyState";
import { captionProblems, toSeconds } from "./CaptionEditor.constants";
import type { CaptionEditorProps, CaptionWordDraft } from "./CaptionEditorInterface";

const INPUT =
	"h-8 w-full rounded-md bg-white/5 px-2 text-sm text-zinc-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-60";

/**
 * Corrige los subtítulos de una escena: qué se muestra de cada palabra (p. ej. "8 min" en vez de
 * "ocho minutos") y cuándo aparece. La voz no cambia.
 */
export function CaptionEditor({
	scenes,
	onSave,
	onPlay,
	onDirtyChange,
	saving = false,
	serverError,
	locked = false,
}: CaptionEditorProps) {
	const [sceneId, setSceneId] = useState(scenes[0]?.id ?? "");
	const scene = scenes.find((s) => s.id === sceneId) ?? scenes[0];
	const [draft, setDraft] = useState<CaptionWordDraft[]>(() => [...(scene?.words ?? [])]);

	// Al cambiar de escena o llegar datos guardados nuevos, el borrador es la versión guardada.
	useEffect(() => setDraft([...(scene?.words ?? [])]), [scene]);
	const dirty = JSON.stringify(draft) !== JSON.stringify(scene?.words ?? []);
	useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

	if (!scene) {
		return (
			<EmptyState
				title="Aún no hay subtítulos que corregir"
				description="Genera la voz: los subtítulos salen de ella, palabra por palabra."
			/>
		);
	}

	const problems = captionProblems(draft, scene.voiceDuration);
	const set = (i: number, patch: Partial<CaptionWordDraft>) =>
		setDraft((words) => words.map((w, j) => (j === i ? { ...w, ...patch } : w)));

	return (
		<form
			noValidate
			onSubmit={(e) => {
				e.preventDefault();
				if (dirty && problems.length === 0)
					onSave(
						scene.id,
						draft.map((w) => ({ ...w, display: w.display?.trim() || undefined })),
					);
			}}
			className="flex flex-col gap-4"
		>
			<SelectField
				id="captions-scene"
				label="Escena"
				value={scene.id}
				options={scenes.map((s) => ({ value: s.id, label: s.label }))}
				onChange={(id) => {
					if (!dirty || window.confirm("Hay cambios sin guardar en esta escena. ¿Descartarlos?"))
						setSceneId(id);
				}}
			/>
			<fieldset disabled={locked} className="flex flex-col gap-1">
				<legend className="sr-only">Palabras de la escena</legend>
				<div className="grid grid-cols-[32px_1fr_1.2fr_88px_88px] gap-2 px-1 text-[11px] text-zinc-500">
					<span />
					<span>Se dice</span>
					<span>Se muestra</span>
					<span>Inicio (s)</span>
					<span>Fin (s)</span>
				</div>
				{draft.map((word, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: las palabras de una voz son fijas; la posición es su identidad
						key={i}
						className="grid grid-cols-[32px_1fr_1.2fr_88px_88px] items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-white/[0.03]"
					>
						<Button
							variant="ghost"
							aria-label={`Escuchar desde "${word.text}"`}
							onClick={() => onPlay(scene.id, word.start)}
							className="h-8 px-0"
						>
							▶
						</Button>
						<span className="truncate text-sm text-zinc-400">{word.text}</span>
						<input
							aria-label={`Texto en pantalla para "${word.text}"`}
							value={word.display ?? ""}
							placeholder={word.text}
							onChange={(e) => set(i, { display: e.target.value || undefined })}
							className={INPUT}
						/>
						<input
							aria-label={`Inicio de "${word.text}"`}
							type="number"
							step={0.05}
							min={0}
							value={Number.isFinite(word.start) ? word.start : ""}
							onChange={(e) => set(i, { start: toSeconds(e.target.value) })}
							className={`${INPUT} font-mono`}
						/>
						<input
							aria-label={`Fin de "${word.text}"`}
							type="number"
							step={0.05}
							min={0}
							value={Number.isFinite(word.end) ? word.end : ""}
							onChange={(e) => set(i, { end: toSeconds(e.target.value) })}
							className={`${INPUT} font-mono`}
						/>
					</div>
				))}
			</fieldset>

			<div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-4 rounded-xl bg-zinc-950/90 px-4 py-3 ring-1 ring-white/10 backdrop-blur">
				<p role="status" className="min-w-0 text-xs text-zinc-400">
					{serverError ? (
						<span className="text-red-400">{serverError}</span>
					) : problems.length > 0 ? (
						<span className="text-amber-300">{problems[0]}</span>
					) : dirty ? (
						"Cambios sin guardar"
					) : (
						"Los tiempos son relativos al inicio de la voz de la escena."
					)}
				</p>
				<div className="flex shrink-0 gap-2">
					<Button
						variant="ghost"
						disabled={!dirty || saving || locked}
						onClick={() => setDraft([...scene.words])}
					>
						Descartar
					</Button>
					<Button type="submit" loading={saving} disabled={!dirty || problems.length > 0 || locked}>
						Guardar subtítulos
					</Button>
				</div>
			</div>
		</form>
	);
}

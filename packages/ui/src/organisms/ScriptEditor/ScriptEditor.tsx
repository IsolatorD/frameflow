import { useEffect, useRef, useState } from "react";
import { Button } from "../../atoms/Button/Button";
import { TextField } from "../../atoms/TextField/TextField";
import { SceneCard } from "../../molecules/SceneCard/SceneCard";
import type { ScriptSceneDraft } from "../../molecules/SceneCard/SceneCardInterface";
import { cleanScript, formatSeconds, NEW_SCENE, scriptProblems } from "./ScriptEditor.constants";
import type { ScriptEditorProps } from "./ScriptEditorInterface";

type Keyed = { key: number; scene: ScriptSceneDraft };

/** Editor del guion escena a escena (modo paso a paso). */
export function ScriptEditor({
	value,
	onSave,
	estimateSeconds,
	onDirtyChange,
	saving = false,
	serverError,
	locked = false,
	lockedReason,
}: ScriptEditorProps) {
	const nextKey = useRef(0);
	const keyed = (scenes: ScriptSceneDraft[]): Keyed[] =>
		scenes.map((scene) => ({ key: nextKey.current++, scene }));

	const [title, setTitle] = useState(value.title);
	const [scenes, setScenes] = useState<Keyed[]>(() => keyed(value.scenes));

	// Un guion guardado nuevo (o generado por la IA) reemplaza el borrador.
	// biome-ignore lint/correctness/useExhaustiveDependencies: `keyed` solo crea claves nuevas
	useEffect(() => {
		setTitle(value.title);
		setScenes(keyed(value.scenes));
	}, [value]);

	const draft = cleanScript({ title, scenes: scenes.map((s) => s.scene) });
	const dirty = JSON.stringify(draft) !== JSON.stringify(cleanScript(value));
	const problems = scriptProblems({ title, scenes: scenes.map((s) => s.scene) });
	const total = draft.scenes.reduce((t, s) => t + estimateSeconds(s.narration), 0);

	useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

	const update = (key: number, scene: ScriptSceneDraft) =>
		setScenes((list) => list.map((s) => (s.key === key ? { key, scene } : s)));
	const move = (index: number, delta: -1 | 1) =>
		setScenes((list) => {
			const copy = [...list];
			const [item] = copy.splice(index, 1);
			if (item) copy.splice(index + delta, 0, item);
			return copy;
		});

	return (
		<form
			noValidate
			onSubmit={(e) => {
				e.preventDefault();
				if (dirty && problems.length === 0) onSave(draft);
			}}
			className="flex flex-col gap-4"
		>
			{locked && lockedReason ? (
				<p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-zinc-400 ring-1 ring-white/10">
					{lockedReason}
				</p>
			) : null}
			<TextField
				id="script-title"
				label="Título del video"
				value={title}
				maxLength={80}
				onChange={setTitle}
				disabled={locked}
			/>
			{scenes.map(({ key, scene }, i) => (
				<SceneCard
					key={key}
					id={`scene-${key}`}
					index={i}
					total={scenes.length}
					scene={scene}
					estimate={formatSeconds(estimateSeconds(scene.narration))}
					onChange={(next) => update(key, next)}
					onMove={(delta) => move(i, delta)}
					onRemove={() => setScenes((list) => list.filter((s) => s.key !== key))}
					disabled={locked}
				/>
			))}
			<Button
				variant="secondary"
				disabled={locked}
				onClick={() => setScenes((list) => [...list, ...keyed([NEW_SCENE])])}
				className="self-start"
			>
				+ Añadir escena
			</Button>

			<div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-4 rounded-xl bg-zinc-950/90 px-4 py-3 ring-1 ring-white/10 backdrop-blur">
				<p role="status" className="min-w-0 text-xs text-zinc-400">
					{serverError ? (
						<span className="text-red-400">{serverError}</span>
					) : dirty && problems.length > 0 ? (
						<span className="text-amber-300">{problems[0]}</span>
					) : (
						<>
							{draft.scenes.length} escenas · ≈ {formatSeconds(total)} de narración
							{dirty ? " · Cambios sin guardar" : ""}
						</>
					)}
				</p>
				<div className="flex shrink-0 gap-2">
					<Button
						variant="ghost"
						disabled={!dirty || saving || locked}
						onClick={() => {
							setTitle(value.title);
							setScenes(keyed(value.scenes));
						}}
					>
						Descartar
					</Button>
					<Button type="submit" loading={saving} disabled={!dirty || problems.length > 0 || locked}>
						Guardar guion
					</Button>
				</div>
			</div>
		</form>
	);
}

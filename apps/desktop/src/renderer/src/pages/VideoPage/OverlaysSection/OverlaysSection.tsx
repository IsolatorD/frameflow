import type { OverlayOp } from "@frameflow/core/script/overlays";
import type { Storyboard } from "@frameflow/core/storyboard";
import { OverlayInspector } from "@frameflow/ui/src/organisms/OverlayInspector/OverlayInspector";
import type { OverlayDraft } from "@frameflow/ui/src/organisms/OverlayInspector/OverlayInspectorInterface";
import { OverlayList } from "@frameflow/ui/src/organisms/OverlayList/OverlayList";
import { useCallback, useMemo, useState } from "react";
import {
	COLOR_OPTIONS,
	draftToPatch,
	overlayDraftOf,
	overlayItems,
} from "./OverlaysSection.constants";

/** Pestaña "Capas": añadir textos, imágenes y videos encima del video y editarlos. */
export function OverlaysSection({
	storyboard,
	selectedId,
	onSelect,
	playhead,
	editOverlays,
	pickMedia,
	draft: pending,
	onDraftChange,
	saving,
	error,
	locked,
}: {
	storyboard: Storyboard;
	selectedId: string | null;
	onSelect: (clipId: string | null) => void;
	/** Segundo actual del reproductor (donde se añaden las capas). */
	playhead: () => number;
	editOverlays: (op: OverlayOp) => Promise<{ clipId: string | null }>;
	pickMedia: () => Promise<Extract<OverlayOp, { op: "add" }>["item"] | null>;
	/** Borrador en curso de la capa seleccionada (lo comparten el inspector y la vista previa). */
	draft: OverlayDraft | null;
	onDraftChange: (patch: { clipId: string; draft: OverlayDraft } | null) => void;
	saving: boolean;
	error?: string;
	locked: boolean;
}) {
	const items = useMemo(() => overlayItems(storyboard), [storyboard]);
	const draft = useMemo(
		() => (selectedId ? overlayDraftOf(storyboard, selectedId) : null),
		[storyboard, selectedId],
	);
	const [adding, setAdding] = useState(false);
	const [addError, setAddError] = useState<string>();

	const run = async (op: OverlayOp) => {
		const result = await editOverlays(op);
		onSelect(result.clipId);
	};
	// El error ya lo muestra el inspector (estado de la mutación): aquí solo se evita el rechazo suelto.
	const runQuietly = (op: OverlayOp) => run(op).catch(() => undefined);
	const reportDraft = useCallback(
		(next: OverlayDraft | null) =>
			onDraftChange(next && selectedId ? { clipId: selectedId, draft: next } : null),
		[onDraftChange, selectedId],
	);
	const add = async (getItem: () => Promise<Extract<OverlayOp, { op: "add" }>["item"] | null>) => {
		setAdding(true);
		setAddError(undefined);
		try {
			const item = await getItem();
			if (item) await run({ op: "add", item, at: playhead() });
		} catch (e) {
			setAddError(e instanceof Error ? e.message : String(e));
		} finally {
			setAdding(false);
		}
	};

	return (
		<div className="flex flex-col gap-5">
			<OverlayList
				items={items}
				selectedId={selectedId}
				onSelect={onSelect}
				onAddText={() => add(async () => ({ type: "text", text: "Tu texto" }))}
				onAddMedia={() => add(pickMedia)}
				adding={adding}
				locked={locked}
				error={addError}
			/>
			{selectedId && draft ? (
				<OverlayInspector
					key={selectedId}
					value={draft}
					colorOptions={COLOR_OPTIONS}
					draft={pending}
					onApply={(next) =>
						void run({ op: "update", clipId: selectedId, patch: draftToPatch(next) })
							.then(() => onDraftChange(null))
							.catch(() => undefined)
					}
					onDraftChange={reportDraft}
					onDuplicate={() => void runQuietly({ op: "duplicate", clipId: selectedId })}
					onDelete={() => void runQuietly({ op: "delete", clipId: selectedId })}
					applying={saving}
					serverError={error}
					locked={locked}
				/>
			) : null}
		</div>
	);
}

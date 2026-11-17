import type { OverlayOp } from "@frameflow/core/script/overlays";
import type { Storyboard } from "@frameflow/core/storyboard";
import { OverlayInspector } from "@frameflow/ui/src/organisms/OverlayInspector/OverlayInspector";
import type {
	OverlayAnimationProps,
	OverlayDraft,
} from "@frameflow/ui/src/organisms/OverlayInspector/OverlayInspectorInterface";
import { OverlayList } from "@frameflow/ui/src/organisms/OverlayList/OverlayList";
import { useMemo, useState } from "react";
import { COLOR_OPTIONS, overlayItems } from "./OverlaysSection.constants";

/** Pestaña "Capas": añadir textos, imágenes y videos encima del video y editarlos. */
export function OverlaysSection({
	storyboard,
	selectedId,
	onSelect,
	playhead,
	editOverlays,
	applyDraft,
	pickMedia,
	value: savedValue,
	draft: pending,
	animation,
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
	/** Guarda el borrador real (con sus fotogramas) de la capa seleccionada. */
	applyDraft: () => Promise<unknown>;
	pickMedia: () => Promise<Extract<OverlayOp, { op: "add" }>["item"] | null>;
	/** La capa seleccionada tal como se ve en el instante del cabezal. */
	value: OverlayDraft | null;
	/** Borrador en curso (también en el instante del cabezal); null = sin cambios. */
	draft: OverlayDraft | null;
	animation?: OverlayAnimationProps;
	/** Recibe cambios "del instante"; quien llama los convierte en fotogramas si hace falta. */
	onDraftChange: (draft: OverlayDraft | null) => void;
	saving: boolean;
	error?: string;
	locked: boolean;
}) {
	const items = useMemo(() => overlayItems(storyboard), [storyboard]);
	const [adding, setAdding] = useState(false);
	const [addError, setAddError] = useState<string>();

	const run = async (op: OverlayOp) => {
		const result = await editOverlays(op);
		onSelect(result.clipId);
	};
	// El error ya lo muestra el inspector (estado de la mutación): aquí solo se evita el rechazo suelto.
	const runQuietly = (op: OverlayOp) => run(op).catch(() => undefined);
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
			{selectedId && savedValue ? (
				<OverlayInspector
					key={selectedId}
					value={savedValue}
					animation={animation}
					colorOptions={COLOR_OPTIONS}
					draft={pending}
					onApply={() => void applyDraft().catch(() => undefined)}
					onDraftChange={onDraftChange}
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

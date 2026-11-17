import type { Storyboard } from "@frameflow/core/storyboard";
import type { OverlayDraft } from "@frameflow/ui/src/organisms/OverlayInspector/OverlayInspectorInterface";
import type { PlayerRef } from "@remotion/player";
import {
	type KeyboardEvent,
	type PointerEvent,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	clamp,
	NUDGE,
	NUDGE_COMMIT_MS,
	round3,
	SCALE_RANGE,
	snapCenter,
	visibleOverlayIds,
} from "./PreviewOverlayEditor.constants";

type Box = { id: string; left: number; top: number; width: number; height: number };
type Drag = {
	clipId: string;
	mode: "move" | "scale";
	pointerX: number;
	pointerY: number;
	base: OverlayDraft;
	/** Para escalar: centro de la caja y distancia inicial al puntero. */
	center: { x: number; y: number };
	startDistance: number;
	moved: boolean;
};

/**
 * Recuadros sobre la vista previa para mover (arrastrar) y escalar (esquina) las capas visibles.
 * Las cajas se miden del DOM del reproductor (data-clip-id), así coinciden con lo que se ve.
 * Arrastrar edita el mismo borrador que el inspector; al soltar se guarda.
 */
export function PreviewOverlayEditor({
	storyboard,
	containerRef,
	playerRef,
	selectedId,
	onSelect,
	baseDraft,
	onDraftChange,
	onCommit,
	disabled,
}: {
	/** Storyboard que se está mostrando (incluido el borrador). */
	storyboard: Storyboard;
	containerRef: RefObject<HTMLDivElement | null>;
	playerRef: RefObject<PlayerRef | null>;
	selectedId: string | null;
	onSelect: (clipId: string) => void;
	/** Estado actual de una capa (borrador si lo hay, si no lo guardado). */
	baseDraft: (clipId: string) => OverlayDraft | null;
	onDraftChange: (clipId: string, draft: OverlayDraft) => void;
	onCommit: (clipId: string, draft: OverlayDraft) => void;
	disabled: boolean;
}) {
	const [boxes, setBoxes] = useState<Box[]>([]);
	const [guides, setGuides] = useState({ x: false, y: false });
	const drag = useRef<Drag | null>(null);
	const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Medir las cajas en cada fotograma de pantalla (siguen al video, a las animaciones y al borrador).
	useEffect(() => {
		let raf = 0;
		const measure = () => {
			const container = containerRef.current;
			const player = playerRef.current;
			if (container && player) {
				const t = player.getCurrentFrame() / storyboard.fps;
				const origin = container.getBoundingClientRect();
				const next: Box[] = visibleOverlayIds(storyboard, t).flatMap((id) => {
					const layer = container.querySelector<HTMLElement>(`[data-clip-id="${CSS.escape(id)}"]`);
					const el = layer?.querySelector<HTMLElement>("[data-clip-box]") ?? layer;
					const r = el?.getBoundingClientRect();
					return r && r.width > 0
						? [
								{
									id,
									left: r.left - origin.left,
									top: r.top - origin.top,
									width: r.width,
									height: r.height,
								},
							]
						: [];
				});
				setBoxes((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
			}
			raf = requestAnimationFrame(measure);
		};
		raf = requestAnimationFrame(measure);
		return () => cancelAnimationFrame(raf);
	}, [containerRef, playerRef, storyboard]);

	useEffect(
		() => () => {
			if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
		},
		[],
	);

	const size = () => {
		const r = containerRef.current?.getBoundingClientRect();
		return { width: r?.width ?? 1, height: r?.height ?? 1 };
	};

	const start = (event: PointerEvent, box: Box, mode: Drag["mode"]) => {
		if (disabled || event.button !== 0) return;
		const base = baseDraft(box.id);
		if (!base) return;
		event.stopPropagation();
		event.currentTarget.setPointerCapture(event.pointerId);
		onSelect(box.id);
		const origin = containerRef.current?.getBoundingClientRect();
		const center = {
			x: (origin?.left ?? 0) + box.left + box.width / 2,
			y: (origin?.top ?? 0) + box.top + box.height / 2,
		};
		drag.current = {
			clipId: box.id,
			mode,
			pointerX: event.clientX,
			pointerY: event.clientY,
			base,
			center,
			startDistance: Math.max(8, Math.hypot(event.clientX - center.x, event.clientY - center.y)),
			moved: false,
		};
	};

	const draftFor = (d: Drag, event: PointerEvent): OverlayDraft => {
		if (d.mode === "scale") {
			const distance = Math.hypot(event.clientX - d.center.x, event.clientY - d.center.y);
			const scale = round3(
				clamp(
					d.base.transform.scale * (distance / d.startDistance),
					SCALE_RANGE.min,
					SCALE_RANGE.max,
				),
			);
			return { ...d.base, transform: { ...d.base.transform, scale } };
		}
		const { width, height } = size();
		const [x, snappedX] = snapCenter(d.base.transform.x + (event.clientX - d.pointerX) / width);
		const [y, snappedY] = snapCenter(d.base.transform.y + (event.clientY - d.pointerY) / height);
		setGuides({ x: snappedX, y: snappedY });
		return { ...d.base, transform: { ...d.base.transform, x, y } };
	};

	const move = (event: PointerEvent) => {
		const d = drag.current;
		if (!d) return;
		if (!d.moved && Math.hypot(event.clientX - d.pointerX, event.clientY - d.pointerY) < 3) return;
		d.moved = true;
		onDraftChange(d.clipId, draftFor(d, event));
	};

	const end = (event: PointerEvent) => {
		const d = drag.current;
		drag.current = null;
		// Primero el borrador final (calcularlo enciende las guías) y después se apagan.
		const final = d?.moved ? draftFor(d, event) : null;
		setGuides({ x: false, y: false });
		if (d && final) onCommit(d.clipId, final);
	};

	const nudge = (event: KeyboardEvent, id: string) => {
		const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
			event.key
		];
		if (!dir || disabled) return;
		const base = baseDraft(id);
		if (!base) return;
		event.preventDefault();
		const step = event.shiftKey ? NUDGE.big : NUDGE.small;
		const next: OverlayDraft = {
			...base,
			transform: {
				...base.transform,
				x: round3(clamp(base.transform.x + (dir[0] ?? 0) * step, 0, 1)),
				y: round3(clamp(base.transform.y + (dir[1] ?? 0) * step, 0, 1)),
			},
		};
		onDraftChange(id, next);
		// Se guarda al dejar de pulsar flechas (una versión por gesto, no por pulsación).
		if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
		nudgeTimer.current = setTimeout(() => onCommit(id, next), NUDGE_COMMIT_MS);
	};

	return (
		<div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
			{guides.x ? (
				<div aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-violet-400/80" />
			) : null}
			{guides.y ? (
				<div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-violet-400/80" />
			) : null}
			{boxes.map((box) => {
				const selected = box.id === selectedId;
				return (
					<button
						key={box.id}
						type="button"
						aria-label={`Capa ${box.id}: arrastra para moverla; flechas para ajustarla`}
						aria-pressed={selected}
						data-preview-box={box.id}
						disabled={disabled}
						onPointerDown={(e) => start(e, box, "move")}
						onPointerMove={move}
						onPointerUp={end}
						onPointerCancel={() => {
							drag.current = null;
							setGuides({ x: false, y: false });
						}}
						onKeyDown={(e) => nudge(e, box.id)}
						onClick={() => onSelect(box.id)}
						className={`pointer-events-auto absolute cursor-move rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-white ${
							selected ? "ring-2 ring-violet-400" : "ring-1 ring-white/40 hover:ring-white/80"
						}`}
						style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
					>
						{selected && !disabled ? (
							<span
								aria-hidden="true"
								data-scale-handle
								onPointerDown={(e) => start(e, box, "scale")}
								className="absolute -right-1.5 -bottom-1.5 size-3 cursor-nwse-resize rounded-sm bg-violet-400 ring-2 ring-zinc-950"
							/>
						) : null}
					</button>
				);
			})}
		</div>
	);
}

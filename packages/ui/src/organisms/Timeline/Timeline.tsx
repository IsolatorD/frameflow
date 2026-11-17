import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { CLIP_COLORS, formatClock, rulerTicks, snap } from "./Timeline.constants";
import type { TimelineClip, TimelineProps } from "./TimelineInterface";

const pct = (value: number, total: number) => `${(value / Math.max(total, 0.001)) * 100}%`;

type Drag = {
	clipId: string;
	mode: "move" | "trim";
	originX: number;
	delta: number;
	moved: boolean;
};

/**
 * Línea de tiempo del video: una fila por pista con sus clips a escala y el cabezal de
 * reproducción. La regla es un deslizador accesible para moverse por el video.
 * Los clips editables se arrastran (mover) o se recortan por su borde derecho; con teclado:
 * flechas para mover y Alt+flechas para recortar (Mayús = pasos de 1 s).
 */
export function Timeline({
	tracks,
	duration,
	time,
	selectedClipId,
	onSeek,
	onSelectClip,
	onMoveClip,
	onTrimClip,
	disabled = false,
}: TimelineProps) {
	const areaRef = useRef<HTMLDivElement>(null);
	const [drag, setDrag] = useState<Drag | null>(null);

	const secondsPerPixel = () => duration / Math.max(1, areaRef.current?.clientWidth ?? 1);
	const trimmed = (clip: TimelineClip, delta: number) => {
		const limits = clip.editable?.trimEnd;
		return limits
			? Math.min(limits.max, Math.max(limits.min, snap(clip.duration + delta)))
			: clip.duration;
	};
	const moved = (clip: TimelineClip, delta: number) =>
		Math.min(Math.max(0, snap(clip.start + delta)), Math.max(0, duration - clip.duration));

	const startDrag = (event: PointerEvent, clip: TimelineClip, mode: Drag["mode"]) => {
		if (disabled || event.button !== 0) return;
		if (mode === "move" && !clip.editable?.move) return;
		if (mode === "trim") event.stopPropagation();
		event.currentTarget.setPointerCapture(event.pointerId);
		setDrag({ clipId: clip.id, mode, originX: event.clientX, delta: 0, moved: false });
	};
	const moveDrag = (event: PointerEvent) => {
		if (!drag) return;
		const delta = (event.clientX - drag.originX) * secondsPerPixel();
		setDrag({ ...drag, delta, moved: drag.moved || Math.abs(event.clientX - drag.originX) > 3 });
	};
	const endDrag = (clip: TimelineClip) => {
		if (!drag || drag.clipId !== clip.id) return;
		if (drag.moved) {
			if (drag.mode === "move") onMoveClip?.(clip.id, moved(clip, drag.delta));
			else onTrimClip?.(clip.id, trimmed(clip, drag.delta));
		}
		// Se conserva `moved` un instante para que el click que sigue al arrastre no cuente.
		setTimeout(() => setDrag(null), 0);
	};

	const onClipKey = (event: KeyboardEvent, clip: TimelineClip) => {
		if (disabled || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
		const step = (event.shiftKey ? 1 : 0.1) * (event.key === "ArrowLeft" ? -1 : 1);
		if (event.altKey && clip.editable?.trimEnd) {
			event.preventDefault();
			onTrimClip?.(clip.id, trimmed(clip, step));
		} else if (!event.altKey && clip.editable?.move) {
			event.preventDefault();
			onMoveClip?.(clip.id, moved(clip, step));
		}
	};

	return (
		<div className="flex flex-col gap-1 rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/10">
			<div className="grid grid-cols-[96px_1fr] items-end gap-2">
				<span className="font-mono text-[11px] whitespace-nowrap text-zinc-400">
					{formatClock(time)} / {formatClock(duration)}
				</span>
				<div className="relative h-5">
					{rulerTicks(duration).map((tick) => (
						<span
							key={tick.at}
							className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center"
							style={{ left: pct(tick.at, duration) }}
						>
							{tick.label ? (
								<span className="font-mono text-[9px] text-zinc-500">{tick.label}</span>
							) : null}
							<span className={`w-px bg-white/20 ${tick.label ? "h-1.5" : "h-1"}`} />
						</span>
					))}
					<input
						type="range"
						aria-label="Posición en el video"
						aria-valuetext={formatClock(time)}
						min={0}
						max={duration}
						step={0.1}
						value={Math.min(time, duration)}
						onChange={(e) => onSeek(Number(e.target.value))}
						className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
					/>
				</div>
			</div>

			<div className="relative flex flex-col gap-1">
				{tracks.map((track, t) => (
					<div key={track.id} className="grid grid-cols-[96px_1fr] items-center gap-2">
						<span className="truncate text-[11px] text-zinc-500" title={track.label}>
							{track.label}
						</span>
						<div
							ref={t === 0 ? areaRef : undefined}
							className="relative h-7 rounded-md bg-white/[0.03]"
						>
							{track.clips.map((clip) => {
								const active = drag?.clipId === clip.id ? drag : null;
								const start = active?.mode === "move" ? moved(clip, active.delta) : clip.start;
								const length =
									active?.mode === "trim" ? trimmed(clip, active.delta) : clip.duration;
								const editable = !disabled && (clip.editable?.move || clip.editable?.trimEnd);
								const hint = [
									clip.editable?.move ? "arrastra o usa las flechas para mover" : null,
									clip.editable?.trimEnd ? "Alt+flechas para cambiar la duración" : null,
								]
									.filter(Boolean)
									.join("; ");
								return (
									<button
										key={clip.id}
										type="button"
										title={`${clip.label} · ${formatClock(clip.start)}–${formatClock(clip.start + clip.duration)}${editable && hint ? ` (${hint})` : ""}`}
										aria-pressed={clip.id === selectedClipId}
										onPointerDown={(e) => startDrag(e, clip, "move")}
										onPointerMove={moveDrag}
										onPointerUp={() => endDrag(clip)}
										onPointerCancel={() => setDrag(null)}
										onKeyDown={(e) => onClipKey(e, clip)}
										onClick={() => {
											if (!drag?.moved) onSelectClip(clip.id);
										}}
										className={`absolute inset-y-0.5 overflow-hidden rounded px-1.5 text-left text-[10px] leading-6 whitespace-nowrap ring-1 transition-shadow select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${CLIP_COLORS[clip.kind]} ${
											clip.id === selectedClipId ? "ring-2 ring-white" : ""
										} ${clip.warning ? "border-b-2 border-amber-400" : ""} ${
											!disabled && clip.editable?.move ? "cursor-grab active:cursor-grabbing" : ""
										} ${active?.moved ? "z-10 opacity-90 shadow-lg" : ""}`}
										style={{ left: pct(start, duration), width: pct(length, duration) }}
									>
										{clip.label}
										{clip.markers?.map((at) => (
											<span
												key={at}
												aria-hidden="true"
												data-keyframe-marker
												className="pointer-events-none absolute bottom-0.5 size-1.5 -translate-x-1/2 rotate-45 bg-white/90"
												style={{ left: pct(at, length) }}
											/>
										))}
										{!disabled && clip.editable?.trimEnd ? (
											<span
												aria-hidden="true"
												data-trim-handle
												onPointerDown={(e) => startDrag(e, clip, "trim")}
												className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r bg-white/20 hover:bg-white/40"
											/>
										) : null}
									</button>
								);
							})}
						</div>
					</div>
				))}
				<div className="pointer-events-none absolute inset-y-0 right-0 left-[104px]">
					<div
						aria-hidden="true"
						className="absolute inset-y-0 w-px bg-red-400 shadow-[0_0_0_1px_rgba(248,113,113,0.3)]"
						style={{ left: pct(Math.min(time, duration), duration) }}
					/>
				</div>
			</div>
		</div>
	);
}

import { CLIP_COLORS, formatClock, rulerTicks } from "./Timeline.constants";
import type { TimelineProps } from "./TimelineInterface";

const pct = (value: number, total: number) => `${(value / Math.max(total, 0.001)) * 100}%`;

/**
 * Línea de tiempo del video: una fila por pista con sus clips a escala y el cabezal de
 * reproducción. La regla es un deslizador accesible para moverse por el video.
 */
export function Timeline({
	tracks,
	duration,
	time,
	selectedClipId,
	onSeek,
	onSelectClip,
}: TimelineProps) {
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
				{tracks.map((track) => (
					<div key={track.id} className="grid grid-cols-[96px_1fr] items-center gap-2">
						<span className="truncate text-[11px] text-zinc-500">{track.label}</span>
						<div className="relative h-7 rounded-md bg-white/[0.03]">
							{track.clips.map((clip) => (
								<button
									key={clip.id}
									type="button"
									title={`${clip.label} · ${formatClock(clip.start)}–${formatClock(clip.start + clip.duration)}`}
									aria-pressed={clip.id === selectedClipId}
									onClick={() => onSelectClip(clip.id)}
									className={`absolute inset-y-0.5 overflow-hidden rounded px-1.5 text-left text-[10px] leading-6 whitespace-nowrap ring-1 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${CLIP_COLORS[clip.kind]} ${
										clip.id === selectedClipId ? "ring-2 ring-white" : ""
									} ${clip.warning ? "border-b-2 border-amber-400" : ""}`}
									style={{ left: pct(clip.start, duration), width: pct(clip.duration, duration) }}
								>
									{clip.label}
								</button>
							))}
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

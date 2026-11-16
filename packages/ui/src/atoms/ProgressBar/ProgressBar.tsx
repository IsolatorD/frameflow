import type { ProgressBarProps } from "./ProgressBarInterface";

export function ProgressBar({ value, label }: ProgressBarProps) {
	const percent = value === null ? null : Math.round(Math.min(1, Math.max(0, value)) * 100);
	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-baseline justify-between gap-3 text-xs">
				<span className="truncate text-zinc-300">{label}</span>
				{percent !== null ? <span className="font-mono text-zinc-500">{percent}%</span> : null}
			</div>
			<div
				role="progressbar"
				aria-label={label}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={percent ?? undefined}
				className="h-1.5 overflow-hidden rounded-full bg-white/10"
			>
				<div
					className={`h-full rounded-full bg-violet-400 transition-[width] ${percent === null ? "w-1/3 animate-pulse" : ""}`}
					style={percent === null ? undefined : { width: `${percent}%` }}
				/>
			</div>
		</div>
	);
}

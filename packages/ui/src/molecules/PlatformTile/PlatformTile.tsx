import { STATUS_CLASS, STATUS_LABEL } from "./PlatformTile.constants";
import type { PlatformTileProps } from "./PlatformTileInterface";

export function PlatformTile({ name, color, status, detail }: PlatformTileProps) {
	return (
		<div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
			<span
				aria-hidden="true"
				className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
				style={{ backgroundColor: color }}
			>
				{name.slice(0, 1)}
			</span>
			<div className="min-w-0 flex-1">
				<p className="text-sm font-medium text-zinc-100">{name}</p>
				<p className="truncate text-xs text-zinc-500">{detail}</p>
			</div>
			<span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${STATUS_CLASS[status]}`}>
				{STATUS_LABEL[status]}
			</span>
		</div>
	);
}

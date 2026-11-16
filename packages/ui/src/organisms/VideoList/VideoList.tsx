import { Badge } from "../../atoms/Badge/Badge";
import type { VideoListProps } from "./VideoListInterface";

/** Lista de videos del canal; cada fila abre el video. */
export function VideoList({ items, onOpen }: VideoListProps) {
	return (
		<ul className="flex flex-col divide-y divide-white/5 overflow-hidden rounded-xl ring-1 ring-white/10">
			{items.map((item) => (
				<li key={item.id}>
					<button
						type="button"
						onClick={() => onOpen(item.id)}
						className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
					>
						<span className="flex min-w-0 flex-1 flex-col">
							<span className="truncate text-sm font-medium text-zinc-100">{item.title}</span>
							<span className="truncate text-xs text-zinc-500">{item.subtitle}</span>
						</span>
						<Badge tone={item.status.tone}>{item.status.label}</Badge>
					</button>
				</li>
			))}
		</ul>
	);
}

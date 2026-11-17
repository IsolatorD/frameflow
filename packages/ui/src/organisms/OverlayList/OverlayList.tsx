import { Button } from "../../atoms/Button/Button";
import type { OverlayListProps } from "./OverlayListInterface";

const ICON = { text: "T", image: "▣", video: "▶" } as const;

/** Capas añadidas al video, con los botones para añadir más (en la posición del cabezal). */
export function OverlayList({
	items,
	selectedId,
	onSelect,
	onAddText,
	onAddMedia,
	adding = false,
	locked = false,
	error,
}: OverlayListProps) {
	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-2">
				<Button variant="secondary" disabled={locked} loading={adding} onClick={onAddText}>
					+ Texto
				</Button>
				<Button variant="secondary" disabled={locked} loading={adding} onClick={onAddMedia}>
					+ Imagen o video
				</Button>
				<span className="text-xs text-zinc-500">Se añade donde está el cabezal.</span>
			</div>
			{error ? (
				<p role="alert" className="text-xs text-red-400">
					{error}
				</p>
			) : null}
			{items.length > 0 ? (
				<ul className="flex flex-col gap-1">
					{items.map((item) => (
						<li key={item.id}>
							<button
								type="button"
								aria-pressed={item.id === selectedId}
								onClick={() => onSelect(item.id)}
								className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ring-1 transition-colors ${
									item.id === selectedId
										? "bg-violet-500/10 ring-violet-400"
										: "ring-white/10 hover:bg-white/5"
								}`}
							>
								<span
									aria-hidden="true"
									className="flex size-6 items-center justify-center rounded bg-white/10 text-xs text-zinc-300"
								>
									{ICON[item.type]}
								</span>
								<span className="flex min-w-0 flex-col">
									<span className="truncate text-sm text-zinc-100">{item.label}</span>
									<span className="text-xs text-zinc-500">{item.detail}</span>
								</span>
							</button>
						</li>
					))}
				</ul>
			) : (
				<p className="text-sm text-zinc-500">
					Aún no hay capas. Añade un texto, una imagen o un clip encima del video.
				</p>
			)}
		</div>
	);
}

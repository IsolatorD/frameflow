import type { ProjectCardProps } from "./ProjectCardInterface";

export function ProjectCard({
	name,
	description,
	presetLabel,
	languages,
	colors,
	onOpen,
}: ProjectCardProps) {
	return (
		<button
			type="button"
			onClick={onOpen}
			className="group flex flex-col overflow-hidden rounded-xl bg-white/[0.03] text-left ring-1 ring-white/10 transition-colors hover:bg-white/[0.06] hover:ring-white/20"
		>
			<span
				aria-hidden="true"
				className="flex h-24 items-center justify-center text-3xl font-semibold"
				style={{ backgroundColor: colors.background, color: colors.accent }}
			>
				{name.slice(0, 1).toUpperCase()}
			</span>
			<span className="flex flex-1 flex-col gap-1 p-4">
				<span className="text-base font-medium text-zinc-100">{name}</span>
				<span className="line-clamp-2 text-sm text-zinc-400">
					{description || "Sin descripción"}
				</span>
				<span className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
					<span className="rounded-full bg-white/5 px-2 py-0.5">{presetLabel}</span>
					<span>{languages.map((l) => l.toUpperCase()).join(" · ")}</span>
				</span>
			</span>
		</button>
	);
}

import type { PresetCardProps } from "./PresetCardInterface";

/** Opción de un grupo de radios con forma de tarjeta: preset de nicho con mini vista previa vertical. */
export function PresetCard({
	name,
	value,
	label,
	description,
	colors,
	selected,
	onSelect,
}: PresetCardProps) {
	return (
		<label
			className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-colors ring-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-violet-400 ${
				selected
					? "bg-violet-500/10 ring-2 ring-violet-400"
					: "bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]"
			}`}
		>
			<input
				type="radio"
				name={name}
				value={value}
				checked={selected}
				onChange={onSelect}
				className="sr-only"
			/>
			<span
				aria-hidden="true"
				className="flex h-14 w-8 shrink-0 flex-col items-center justify-center gap-1 rounded-md"
				style={{ backgroundColor: colors.background }}
			>
				<span className="h-1 w-4 rounded-full" style={{ backgroundColor: colors.text }} />
				<span className="h-1.5 w-5 rounded-full" style={{ backgroundColor: colors.accent }} />
				<span className="h-1 w-3 rounded-full" style={{ backgroundColor: colors.text }} />
			</span>
			<span className="min-w-0">
				<span className="block text-sm font-medium text-zinc-100">{label}</span>
				<span className="block text-xs text-zinc-400">{description}</span>
			</span>
		</label>
	);
}

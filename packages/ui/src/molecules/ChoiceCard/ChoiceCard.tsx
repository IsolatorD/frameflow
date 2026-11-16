import type { ChoiceCardProps } from "./ChoiceCardInterface";

/** Opción grande de un grupo de radio (p. ej. modo automático / paso a paso). */
export function ChoiceCard({
	name,
	value,
	title,
	description,
	selected,
	onSelect,
	disabled = false,
	note,
}: ChoiceCardProps) {
	return (
		<label
			className={`flex flex-col gap-1 rounded-xl p-4 ring-1 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-violet-400 ${
				disabled
					? "cursor-not-allowed opacity-60 ring-white/10"
					: selected
						? "cursor-pointer bg-violet-500/10 ring-violet-400"
						: "cursor-pointer ring-white/10 hover:bg-white/5"
			}`}
		>
			<input
				type="radio"
				name={name}
				value={value}
				checked={selected}
				disabled={disabled}
				onChange={() => onSelect(value)}
				className="sr-only"
			/>
			<span className="text-sm font-semibold text-zinc-100">{title}</span>
			<span className="text-xs text-zinc-400">{description}</span>
			{note ? <span className="mt-1 text-xs text-amber-300">{note}</span> : null}
		</label>
	);
}

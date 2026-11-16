import type { ToggleChipsProps } from "./ToggleChipsInterface";

/** Selección múltiple en forma de chips (p. ej. idiomas del proyecto). */
export function ToggleChips({ label, options, selected, onChange, error }: ToggleChipsProps) {
	const toggle = (value: string) =>
		onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

	return (
		<fieldset className="flex flex-col gap-1.5">
			<legend className="mb-1.5 text-sm font-medium text-zinc-200">{label}</legend>
			<div className="flex flex-wrap gap-2">
				{options.map((option) => {
					const active = selected.includes(option.value);
					return (
						<button
							key={option.value}
							type="button"
							aria-pressed={active}
							onClick={() => toggle(option.value)}
							className={`h-8 rounded-full px-3 text-sm ring-1 transition-colors ${
								active
									? "bg-violet-500/15 text-violet-200 ring-violet-400"
									: "text-zinc-300 ring-white/10 hover:bg-white/5"
							}`}
						>
							{option.label}
						</button>
					);
				})}
			</div>
			{error ? <p className="text-xs text-red-400">{error}</p> : null}
		</fieldset>
	);
}

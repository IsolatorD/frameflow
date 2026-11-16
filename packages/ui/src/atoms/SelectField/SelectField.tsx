import type { SelectFieldProps } from "./SelectFieldInterface";

export function SelectField({ id, label, value, options, onChange, hint }: SelectFieldProps) {
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className="text-sm font-medium text-zinc-200">
				{label}
			</label>
			<select
				id={id}
				value={value}
				aria-describedby={hint ? `${id}-hint` : undefined}
				onChange={(e) => onChange(e.target.value)}
				className="h-9 w-full rounded-lg bg-white/5 px-2.5 text-sm text-zinc-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-violet-400 [&>option]:bg-zinc-900"
			>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
			{hint ? (
				<p id={`${id}-hint`} className="text-xs text-zinc-500">
					{hint}
				</p>
			) : null}
		</div>
	);
}

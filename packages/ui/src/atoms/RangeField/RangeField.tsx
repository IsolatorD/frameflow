import type { RangeFieldProps } from "./RangeFieldInterface";

export function RangeField({
	id,
	label,
	value,
	min,
	max,
	step = 1,
	onChange,
	format = String,
	disabled = false,
}: RangeFieldProps) {
	return (
		<div className={`flex flex-col gap-1.5 ${disabled ? "opacity-50" : ""}`}>
			<div className="flex items-baseline justify-between">
				<label htmlFor={id} className="text-sm font-medium text-zinc-200">
					{label}
				</label>
				<output htmlFor={id} className="font-mono text-xs text-zinc-400">
					{format(value)}
				</output>
			</div>
			<input
				id={id}
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				disabled={disabled}
				aria-valuetext={format(value)}
				onChange={(e) => onChange(Number(e.target.value))}
				className="h-9 w-full cursor-pointer accent-violet-400 disabled:cursor-not-allowed"
			/>
		</div>
	);
}

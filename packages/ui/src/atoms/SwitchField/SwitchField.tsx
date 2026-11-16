import type { SwitchFieldProps } from "./SwitchFieldInterface";

/** Interruptor accesible: un checkbox nativo con aspecto de switch. */
export function SwitchField({ label, description, checked, onChange }: SwitchFieldProps) {
	return (
		<label className="flex cursor-pointer items-start justify-between gap-4">
			<span className="flex flex-col gap-0.5">
				<span className="text-sm font-medium text-zinc-200">{label}</span>
				{description ? <span className="text-xs text-zinc-500">{description}</span> : null}
			</span>
			<input
				type="checkbox"
				role="switch"
				aria-checked={checked}
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
				className="peer sr-only"
			/>
			<span
				aria-hidden="true"
				className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-white/15 transition-colors peer-checked:bg-violet-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-violet-400 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4"
			/>
		</label>
	);
}

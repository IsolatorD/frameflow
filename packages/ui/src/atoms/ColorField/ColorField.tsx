import { pickerValue } from "./ColorField.constants";
import type { ColorFieldProps } from "./ColorFieldInterface";

/** Color con selector visual y campo hexadecimal (para pegar colores exactos de la marca). */
export function ColorField({ id, label, value, onChange, error }: ColorFieldProps) {
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className="text-sm font-medium text-zinc-200">
				{label}
			</label>
			<div
				className={`flex h-9 items-center gap-2 rounded-lg bg-white/5 pr-3 pl-1.5 ring-1 focus-within:ring-2 ${
					error ? "ring-red-400" : "ring-white/10 focus-within:ring-violet-400"
				}`}
			>
				<input
					type="color"
					aria-label={`${label}: selector`}
					value={pickerValue(value)}
					onChange={(e) => onChange(e.target.value.toUpperCase())}
					className="size-6 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-white/20"
				/>
				<input
					id={id}
					value={value}
					maxLength={7}
					spellCheck={false}
					aria-invalid={Boolean(error)}
					aria-describedby={error ? `${id}-error` : undefined}
					onChange={(e) => {
						const text = e.target.value.trim().toUpperCase();
						onChange(text.startsWith("#") ? text : `#${text}`);
					}}
					className="w-full bg-transparent font-mono text-sm text-zinc-100 focus:outline-none"
				/>
			</div>
			{error ? (
				<p id={`${id}-error`} className="text-xs text-red-400">
					{error}
				</p>
			) : null}
		</div>
	);
}

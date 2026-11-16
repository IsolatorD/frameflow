import type { TextFieldProps } from "./TextFieldInterface";

const FIELD =
	"w-full rounded-lg bg-white/5 px-3 text-sm text-zinc-100 ring-1 ring-white/10 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-400";

export function TextField({
	id,
	label,
	value,
	onChange,
	placeholder,
	error,
	hint,
	multiline = false,
	maxLength,
	autoFocus,
	type = "text",
	disabled = false,
}: TextFieldProps) {
	const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
	const common = {
		id,
		value,
		placeholder,
		maxLength,
		autoFocus,
		disabled,
		"aria-invalid": Boolean(error),
		"aria-describedby": describedBy,
	};

	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className="text-sm font-medium text-zinc-200">
				{label}
			</label>
			{multiline ? (
				<textarea
					{...common}
					rows={3}
					className={`${FIELD} resize-none py-2 disabled:opacity-60`}
					onChange={(e) => onChange(e.target.value)}
				/>
			) : (
				<input
					{...common}
					type={type}
					className={`${FIELD} h-9 disabled:opacity-60`}
					onChange={(e) => onChange(e.target.value)}
				/>
			)}
			{error ? (
				<p id={`${id}-error`} className="text-xs text-red-400">
					{error}
				</p>
			) : hint ? (
				<p id={`${id}-hint`} className="text-xs text-zinc-500">
					{hint}
				</p>
			) : null}
		</div>
	);
}

import { SelectField } from "../../atoms/SelectField/SelectField";
import { ChoiceCard } from "../ChoiceCard/ChoiceCard";
import type { VisualStylePickerProps } from "./VisualStylePickerInterface";

/** Elegir el estilo visual (preset) y sus opciones, p. ej. el modelo 3D del holograma. */
export function VisualStylePicker({
	idPrefix,
	styles,
	value,
	onChange,
	disabled,
}: VisualStylePickerProps) {
	const current = styles.find((s) => s.id === value.id) ?? styles[0];
	return (
		<div className="flex flex-col gap-3">
			<fieldset>
				<legend className="sr-only">Estilo visual</legend>
				<div className="grid grid-cols-2 gap-3">
					{styles.map((style) => (
						<ChoiceCard
							key={style.id}
							name={`${idPrefix}-style`}
							value={style.id}
							title={style.name}
							description={style.description}
							selected={style.id === current?.id}
							disabled={disabled}
							onSelect={(id) => {
								const next = styles.find((s) => s.id === id);
								onChange({
									id,
									options: Object.fromEntries(
										(next?.options ?? []).map((o) => [o.id, value.options[o.id] ?? o.default]),
									),
								});
							}}
						/>
					))}
				</div>
			</fieldset>
			{current?.options.map((option) => (
				<SelectField
					key={option.id}
					id={`${idPrefix}-option-${option.id}`}
					label={option.label}
					value={value.options[option.id] ?? option.default}
					options={option.choices.map((c) => ({ value: c.id, label: c.label }))}
					onChange={(choice) =>
						onChange({ ...value, options: { ...value.options, [option.id]: choice } })
					}
				/>
			))}
			{current?.credit ? <p className="text-xs text-zinc-500">{current.credit}</p> : null}
		</div>
	);
}

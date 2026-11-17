import { ColorField } from "../../atoms/ColorField/ColorField";
import { RangeField } from "../../atoms/RangeField/RangeField";
import { SelectField } from "../../atoms/SelectField/SelectField";
import { SwitchField } from "../../atoms/SwitchField/SwitchField";
import type { TransitionDraft } from "../SceneCard/SceneCardInterface";
import { formatPause, TRANSITION_OPTIONS } from "./SceneStyleFields.constants";
import type { SceneStyleFieldsProps } from "./SceneStyleFieldsInterface";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Ajustes visuales de una escena: colores propios, transiciones y pausa tras la voz. */
export function SceneStyleFields({
	idPrefix,
	settings,
	onChange,
	defaultTheme,
	extraTimeRange,
}: SceneStyleFieldsProps) {
	const customColors = settings.accent !== undefined || settings.background !== undefined;
	const set = (patch: Partial<typeof settings>) => onChange({ ...settings, ...patch });

	return (
		<div className="flex flex-col gap-4">
			<SwitchField
				label="Colores propios"
				description="Destaca esta escena con otro acento o fondo."
				checked={customColors}
				onChange={(on) =>
					set(
						on
							? { accent: defaultTheme.accent, background: defaultTheme.background }
							: { accent: undefined, background: undefined },
					)
				}
			/>
			{customColors ? (
				<div className="grid grid-cols-2 gap-4">
					<ColorField
						id={`${idPrefix}-accent`}
						label="Acento"
						value={settings.accent ?? defaultTheme.accent}
						error={settings.accent && !HEX.test(settings.accent) ? "Usa #RRGGBB" : undefined}
						onChange={(accent) => set({ accent })}
					/>
					<ColorField
						id={`${idPrefix}-background`}
						label="Fondo"
						value={settings.background ?? defaultTheme.background}
						error={
							settings.background && !HEX.test(settings.background) ? "Usa #RRGGBB" : undefined
						}
						onChange={(background) => set({ background })}
					/>
				</div>
			) : null}
			<div className="grid grid-cols-2 gap-4">
				<SelectField
					id={`${idPrefix}-enter`}
					label="Entrada"
					value={settings.enter ?? "none"}
					options={TRANSITION_OPTIONS}
					onChange={(v) => set({ enter: v as TransitionDraft })}
				/>
				<SelectField
					id={`${idPrefix}-exit`}
					label="Salida"
					value={settings.exit ?? "fade"}
					options={TRANSITION_OPTIONS}
					onChange={(v) => set({ exit: v as TransitionDraft })}
				/>
			</div>
			<RangeField
				id={`${idPrefix}-extra`}
				label="Pausa después de la voz"
				value={settings.extraTime ?? 0}
				{...extraTimeRange}
				format={formatPause}
				onChange={(extraTime) => set({ extraTime })}
			/>
		</div>
	);
}

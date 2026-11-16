import { type FormEvent, useState } from "react";
import { Button } from "../../atoms/Button/Button";
import { TextField } from "../../atoms/TextField/TextField";
import { PresetCard } from "../../molecules/PresetCard/PresetCard";
import { ToggleChips } from "../../molecules/ToggleChips/ToggleChips";
import {
	type CreateProjectErrors,
	LANGUAGE_OPTIONS,
	validateCreateProject,
} from "./CreateProjectForm.constants";
import type { CreateProjectFormProps, CreateProjectValues } from "./CreateProjectFormInterface";

export function CreateProjectForm({
	presets,
	onSubmit,
	onCancel,
	submitting = false,
	serverError,
}: CreateProjectFormProps) {
	const [values, setValues] = useState<CreateProjectValues>({
		name: "",
		description: "",
		presetId: presets[0]?.id ?? "",
		languages: ["es"],
	});
	const [errors, setErrors] = useState<CreateProjectErrors>({});

	const update = <K extends keyof CreateProjectValues>(key: K, value: CreateProjectValues[K]) => {
		setValues((v) => ({ ...v, [key]: value }));
		setErrors((e) => ({ ...e, [key]: undefined })); // el error se limpia al editar
	};

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		const found = validateCreateProject(values);
		setErrors(found);
		if (Object.keys(found).length === 0) onSubmit(values);
	};

	return (
		<form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
			<TextField
				id="project-name"
				label="Nombre del canal"
				placeholder="Astroinfo"
				value={values.name}
				onChange={(v) => update("name", v)}
				error={errors.name}
				maxLength={60}
				autoFocus
			/>
			<TextField
				id="project-description"
				label="Descripción"
				placeholder="Astronomía, datos curiosos y noticias del espacio"
				value={values.description}
				onChange={(v) => update("description", v)}
				hint="Opcional. Ayuda a la IA a entender el canal."
				maxLength={280}
				multiline
			/>
			<fieldset className="flex flex-col gap-1.5">
				<legend className="mb-1.5 text-sm font-medium text-zinc-200">Nicho de partida</legend>
				<div className="grid grid-cols-2 gap-2">
					{presets.map((preset) => (
						<PresetCard
							key={preset.id}
							name="project-preset"
							value={preset.id}
							label={preset.label}
							description={preset.description}
							colors={preset.colors}
							selected={values.presetId === preset.id}
							onSelect={() => update("presetId", preset.id)}
						/>
					))}
				</div>
				<p className="text-xs text-zinc-500">
					Define colores, voz y tono iniciales. Luego podrás personalizarlos.
				</p>
				{errors.presetId ? <p className="text-xs text-red-400">{errors.presetId}</p> : null}
			</fieldset>
			<ToggleChips
				label="Idiomas"
				options={LANGUAGE_OPTIONS}
				selected={values.languages}
				onChange={(v) => update("languages", v)}
				error={errors.languages}
			/>
			{serverError ? (
				<p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
					{serverError}
				</p>
			) : null}
			<div className="flex justify-end gap-2">
				<Button variant="ghost" onClick={onCancel}>
					Cancelar
				</Button>
				<Button type="submit" loading={submitting}>
					Crear proyecto
				</Button>
			</div>
		</form>
	);
}

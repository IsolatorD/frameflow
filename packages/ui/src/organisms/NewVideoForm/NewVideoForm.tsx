import { type FormEvent, useState } from "react";
import { Button } from "../../atoms/Button/Button";
import { RangeField } from "../../atoms/RangeField/RangeField";
import { SelectField } from "../../atoms/SelectField/SelectField";
import { TextField } from "../../atoms/TextField/TextField";
import { ChoiceCard } from "../../molecules/ChoiceCard/ChoiceCard";
import type { NewVideoFormProps, NewVideoValues } from "./NewVideoFormInterface";

const formatDuration = (s: number) =>
	s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}`;

/** Primer paso de un video: tema, idioma, duración y modo. */
export function NewVideoForm({
	languages,
	secondsRange,
	ai,
	onOpenAiSettings,
	onSubmit,
	submitting = false,
	serverError,
}: NewVideoFormProps) {
	const [values, setValues] = useState<NewVideoValues>({
		topic: "",
		language: languages[0]?.value ?? "es",
		targetSeconds: 60,
		mode: "stepwise",
	});
	const [error, setError] = useState<string>();
	const set = <K extends keyof NewVideoValues>(key: K, value: NewVideoValues[K]) => {
		setValues((v) => ({ ...v, [key]: value }));
		if (key === "topic") setError(undefined);
	};

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		if (values.topic.trim().length < 3) {
			setError("Describe el tema con al menos 3 caracteres");
			return;
		}
		onSubmit({ ...values, topic: values.topic.trim() });
	};

	return (
		<form onSubmit={handleSubmit} noValidate className="flex max-w-2xl flex-col gap-6">
			<TextField
				id="video-topic"
				label="¿De qué trata el video?"
				placeholder="Por qué la luz del Sol que vemos es del pasado"
				value={values.topic}
				onChange={(v) => set("topic", v)}
				error={error}
				hint="Un tema concreto funciona mejor que uno general."
				maxLength={300}
				multiline
				autoFocus
			/>
			<div className="grid grid-cols-2 gap-6">
				<SelectField
					id="video-language"
					label="Idioma"
					value={values.language}
					options={languages}
					onChange={(v) => set("language", v)}
				/>
				<RangeField
					id="video-duration"
					label="Duración aproximada"
					value={values.targetSeconds}
					{...secondsRange}
					format={formatDuration}
					onChange={(v) => set("targetSeconds", v)}
				/>
			</div>
			<fieldset className="flex flex-col gap-2">
				<legend className="mb-2 text-sm font-medium text-zinc-200">¿Cómo lo hacemos?</legend>
				<div className="grid grid-cols-2 gap-3">
					<ChoiceCard
						name="video-mode"
						value="auto"
						title="Automático con IA"
						description="La IA escribe el guion; Frameflow pone la voz y crea el video de una vez."
						selected={values.mode === "auto"}
						onSelect={() => set("mode", "auto")}
						disabled={!ai?.available}
						note={ai === null ? "Comprobando la IA…" : ai.available ? `Usa ${ai.name}` : ai.reason}
					/>
					<ChoiceCard
						name="video-mode"
						value="stepwise"
						title="Paso a paso"
						description="Empiezas con una plantilla de guion, la editas, y decides cuándo poner voz y crear el video."
						selected={values.mode === "stepwise"}
						onSelect={() => set("mode", "stepwise")}
					/>
				</div>
				{ai && onOpenAiSettings ? (
					<button
						type="button"
						onClick={onOpenAiSettings}
						className="self-start text-xs text-violet-300 underline-offset-2 hover:underline"
					>
						{ai.available ? "Cambiar la IA" : "Configurar la IA"}
					</button>
				) : null}
			</fieldset>
			{serverError ? (
				<p role="alert" className="text-sm text-red-400">
					{serverError}
				</p>
			) : null}
			<Button type="submit" loading={submitting} className="self-start">
				Crear video
			</Button>
		</form>
	);
}

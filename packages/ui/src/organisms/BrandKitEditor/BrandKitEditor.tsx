import { useEffect, useState } from "react";
import { Button } from "../../atoms/Button/Button";
import { ColorField } from "../../atoms/ColorField/ColorField";
import { RangeField } from "../../atoms/RangeField/RangeField";
import { SelectField } from "../../atoms/SelectField/SelectField";
import { SwitchField } from "../../atoms/SwitchField/SwitchField";
import { TextField } from "../../atoms/TextField/TextField";
import { BrandPreview } from "../../molecules/BrandPreview/BrandPreview";
import { ReferenceColors } from "../../molecules/ReferenceColors/ReferenceColors";
import { Section } from "../../molecules/Section/Section";
import { VisualStylePicker } from "../../molecules/VisualStylePicker/VisualStylePicker";
import {
	COLOR_FIELDS,
	colorErrors,
	formatSpeed,
	formatWords,
	hashtagsToText,
	sameKit,
} from "./BrandKitEditor.constants";
import type { BrandKitDraft, BrandKitEditorProps } from "./BrandKitEditorInterface";

/** Editor de la identidad del canal con vista previa en vivo. */
export function BrandKitEditor({
	value,
	languages,
	fontOptions,
	visualStyles,
	speedRange,
	wordsPerPageRange,
	parseHashtags,
	getWarnings,
	readReference,
	onSave,
	onDirtyChange,
	saving = false,
	serverError,
	saved = false,
}: BrandKitEditorProps) {
	const [draft, setDraft] = useState<BrandKitDraft>(value);
	const [hashtagsText, setHashtagsText] = useState(() => hashtagsToText(value.defaultHashtags));

	const candidate: BrandKitDraft = { ...draft, defaultHashtags: parseHashtags(hashtagsText) };
	const dirty = !sameKit(candidate, value);
	const errors = colorErrors(draft.theme);
	const invalid = Object.keys(errors).length > 0;
	const warnings = invalid ? [] : (getWarnings?.(draft.theme) ?? []);

	useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

	// Cuando llega un valor guardado nuevo, el borrador pasa a ser ese (hashtags ya normalizados).
	useEffect(() => {
		setDraft(value);
		setHashtagsText(hashtagsToText(value.defaultHashtags));
	}, [value]);

	const set = <K extends keyof BrandKitDraft>(key: K, next: BrandKitDraft[K]) =>
		setDraft((d) => ({ ...d, [key]: next }));
	const setVoice = (code: string, patch: Partial<BrandKitDraft["voices"][string]>) =>
		setDraft((d) => {
			const current = d.voices[code];
			return current ? { ...d, voices: { ...d.voices, [code]: { ...current, ...patch } } } : d;
		});
	const discard = () => {
		setDraft(value);
		setHashtagsText(hashtagsToText(value.defaultHashtags));
	};

	return (
		<form
			noValidate
			onSubmit={(e) => {
				e.preventDefault();
				if (!invalid && dirty) onSave(candidate);
			}}
			className="grid grid-cols-[minmax(0,1fr)_260px] items-start gap-6"
		>
			<div className="flex flex-col gap-5">
				<Section title="Colores" description="Se aplican a todos los videos nuevos del canal.">
					<div className="grid grid-cols-2 gap-4">
						{COLOR_FIELDS.map(({ key, label }) => (
							<ColorField
								key={key}
								id={`brand-color-${key}`}
								label={label}
								value={draft.theme[key]}
								error={errors[key]}
								onChange={(color) => set("theme", { ...draft.theme, [key]: color })}
							/>
						))}
					</div>
					{readReference ? (
						<ReferenceColors
							id="brand-reference"
							onRead={readReference}
							onUse={(theme) => set("theme", theme)}
						/>
					) : null}
					{warnings.length > 0 ? (
						<ul className="mt-4 flex flex-col gap-1 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-400/30">
							{warnings.map((w) => (
								<li key={w}>⚠ {w}</li>
							))}
						</ul>
					) : null}
				</Section>

				<Section
					title="Estilo visual"
					description="Cómo se ven las escenas de los videos nuevos. Cada video puede cambiarlo o dejarlo libre."
				>
					<VisualStylePicker
						idPrefix="brand"
						styles={visualStyles}
						value={draft.visualStyle}
						onChange={(style) => set("visualStyle", style)}
					/>
				</Section>

				<Section title="Tipografía">
					<SelectField
						id="brand-font"
						label="Fuente de los videos"
						value={draft.fontFamily}
						options={fontOptions}
						onChange={(font) => set("fontFamily", font)}
						hint="Google Fonts; el motor de video la descarga al renderizar."
					/>
				</Section>

				<Section title="Voces" description="Una voz de narración por idioma del canal.">
					<div className="flex flex-col gap-5">
						{languages.map((language) => {
							const voice = draft.voices[language.code];
							if (!voice) return null;
							const recorded = voice.engine === "recorded";
							return (
								<div key={language.code} className="flex flex-col gap-3">
									<SelectField
										id={`brand-engine-${language.code}`}
										label={`Narración en ${language.label.toLowerCase()}`}
										value={voice.engine}
										options={[
											{ value: "kokoro", label: "Voz sintética (se genera sola)" },
											{ value: "recorded", label: "Mi voz (la grabo yo)" },
										]}
										onChange={(engine) =>
											setVoice(language.code, { engine: engine as "kokoro" | "recorded" })
										}
										hint={
											recorded
												? "Cada escena se graba desde el guion («Grabar»). Si una escena no tiene voz, el video no se puede crear."
												: undefined
										}
									/>
									{recorded ? null : (
										<div className="grid grid-cols-2 gap-4">
											<SelectField
												id={`brand-voice-${language.code}`}
												label={`Voz en ${language.label.toLowerCase()}`}
												value={voice.voiceId}
												options={language.voiceOptions}
												onChange={(voiceId) => setVoice(language.code, { voiceId })}
											/>
											<RangeField
												id={`brand-speed-${language.code}`}
												label="Velocidad"
												value={voice.speed}
												{...speedRange}
												format={formatSpeed}
												onChange={(speed) => setVoice(language.code, { speed })}
											/>
										</div>
									)}
								</div>
							);
						})}
					</div>
				</Section>

				<Section title="Subtítulos">
					<div className="flex flex-col gap-4">
						<SwitchField
							label="Subtítulos sincronizados"
							description="Palabra por palabra, resaltando la que suena."
							checked={draft.captions.enabled}
							onChange={(enabled) => set("captions", { ...draft.captions, enabled })}
						/>
						<RangeField
							id="brand-words-per-page"
							label="Palabras en pantalla a la vez"
							value={draft.captions.maxWordsPerPage}
							{...wordsPerPageRange}
							format={formatWords}
							disabled={!draft.captions.enabled}
							onChange={(maxWordsPerPage) =>
								set("captions", { ...draft.captions, maxWordsPerPage })
							}
						/>
					</div>
				</Section>

				<Section
					title="Voz del canal"
					description="Lo que la IA tiene en cuenta al escribir guiones."
				>
					<div className="flex flex-col gap-4">
						<TextField
							id="brand-tone"
							label="Tono"
							value={draft.tone}
							onChange={(tone) => set("tone", tone)}
							maxLength={400}
							multiline
						/>
						<TextField
							id="brand-cta"
							label="Llamada a la acción"
							placeholder="Síguenos para más datos del espacio"
							value={draft.ctaText}
							onChange={(ctaText) => set("ctaText", ctaText)}
							hint="Opcional. Aparece al final de cada video."
							maxLength={120}
						/>
						<TextField
							id="brand-hashtags"
							label="Hashtags por defecto"
							placeholder="#astronomía #espacio #ciencia"
							value={hashtagsText}
							onChange={setHashtagsText}
							hint="Separados por espacios o comas; el # es opcional."
						/>
					</div>
				</Section>
			</div>

			<aside className="sticky top-0 flex flex-col items-center gap-4">
				<BrandPreview
					size="lg"
					theme={invalid ? value.theme : draft.theme}
					fontFamily={draft.fontFamily}
					captions={draft.captions}
					ctaText={draft.ctaText.trim()}
				/>
				<div className="flex w-full flex-col gap-2">
					<Button type="submit" loading={saving} disabled={!dirty || invalid}>
						Guardar cambios
					</Button>
					<Button variant="ghost" onClick={discard} disabled={!dirty || saving}>
						Descartar
					</Button>
					<p role="status" className="min-h-4 text-center text-xs text-zinc-500">
						{serverError ? (
							<span className="text-red-400">{serverError}</span>
						) : dirty ? (
							"Cambios sin guardar"
						) : saved ? (
							"Guardado"
						) : null}
					</p>
				</div>
			</aside>
		</form>
	);
}

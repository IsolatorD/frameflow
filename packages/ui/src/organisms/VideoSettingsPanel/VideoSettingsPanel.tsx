import { useEffect, useState } from "react";
import { Button } from "../../atoms/Button/Button";
import { RangeField } from "../../atoms/RangeField/RangeField";
import { SwitchField } from "../../atoms/SwitchField/SwitchField";
import { TextField } from "../../atoms/TextField/TextField";
import { Section } from "../../molecules/Section/Section";
import { VisualStylePicker } from "../../molecules/VisualStylePicker/VisualStylePicker";
import type { VideoSettingsDraft, VideoSettingsPanelProps } from "./VideoSettingsPanelInterface";

const percent = (v: number) => `${Math.round(v * 100)}%`;
const secondsLabel = (v: number) => (v === 0 ? "Sin fundido" : `${v} s`);
const words = (n: number) => (n === 1 ? "1 palabra" : `${n} palabras`);

/** Ajustes del video que no son del guion: subtítulos, llamada a la acción y música de fondo. */
export function VideoSettingsPanel({
	value,
	onSave,
	onPickMusic,
	wordsPerPageRange,
	volumeRange,
	defaultSfxVolume = 0.4,
	onDirtyChange,
	saving = false,
	serverError,
	locked = false,
	visualStyles,
	projectStyleLabel,
}: VideoSettingsPanelProps) {
	const [draft, setDraft] = useState<VideoSettingsDraft>(value);
	const [picking, setPicking] = useState(false);
	const [pickError, setPickError] = useState<string>();

	useEffect(() => setDraft(value), [value]);
	const dirty = JSON.stringify(draft) !== JSON.stringify(value);
	useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

	const pickMusic = async () => {
		setPicking(true);
		setPickError(undefined);
		try {
			const music = await onPickMusic();
			if (music) setDraft((d) => ({ ...d, music }));
		} catch (error) {
			setPickError(error instanceof Error ? error.message : String(error));
		} finally {
			setPicking(false);
		}
	};
	const setMusic = (patch: Partial<NonNullable<VideoSettingsDraft["music"]>>) =>
		setDraft((d) => (d.music ? { ...d, music: { ...d.music, ...patch } } : d));

	return (
		<form
			noValidate
			onSubmit={(e) => {
				e.preventDefault();
				if (dirty) onSave({ ...draft, ctaText: draft.ctaText.trim() });
			}}
			className="flex flex-col gap-4"
		>
			<fieldset disabled={locked} className="flex flex-col gap-4">
				<Section
					title="Estilo visual"
					description={
						projectStyleLabel
							? `El del proyecto es «${projectStyleLabel}»; aquí lo cambias solo para este video.`
							: "Cómo se ven las escenas de este video."
					}
				>
					<VisualStylePicker
						idPrefix="video"
						styles={visualStyles}
						value={draft.visualStyle}
						onChange={(visualStyle) => setDraft((d) => ({ ...d, visualStyle }))}
						disabled={locked}
					/>
				</Section>
				<Section title="Subtítulos">
					<div className="flex flex-col gap-4">
						<SwitchField
							label="Subtítulos sincronizados"
							checked={draft.captions.enabled}
							onChange={(enabled) =>
								setDraft((d) => ({ ...d, captions: { ...d.captions, enabled } }))
							}
						/>
						<RangeField
							id="video-words-per-page"
							label="Palabras en pantalla a la vez"
							value={draft.captions.maxWordsPerPage}
							{...wordsPerPageRange}
							format={words}
							disabled={!draft.captions.enabled}
							onChange={(maxWordsPerPage) =>
								setDraft((d) => ({ ...d, captions: { ...d.captions, maxWordsPerPage } }))
							}
						/>
					</div>
				</Section>

				<Section
					title="Llamada a la acción"
					description="Aparece en los últimos segundos del video."
				>
					<TextField
						id="video-cta"
						label="Texto"
						placeholder="Síguenos para más"
						value={draft.ctaText}
						maxLength={120}
						hint="Déjalo vacío para no mostrarla."
						onChange={(ctaText) => setDraft((d) => ({ ...d, ctaText }))}
					/>
				</Section>

				<Section
					title="Música de fondo"
					description="Se repite hasta cubrir el video y suena por debajo de la voz."
				>
					{draft.music ? (
						<div className="flex flex-col gap-4">
							<div className="flex items-center justify-between gap-3">
								<span className="truncate text-sm text-zinc-200" title={draft.music.label}>
									♪ {draft.music.label}
								</span>
								<div className="flex shrink-0 gap-1">
									<Button variant="ghost" loading={picking} onClick={pickMusic}>
										Cambiar
									</Button>
									<Button variant="ghost" onClick={() => setDraft((d) => ({ ...d, music: null }))}>
										Quitar
									</Button>
								</div>
							</div>
							<RangeField
								id="video-music-volume"
								label="Volumen"
								value={draft.music.volume}
								{...volumeRange}
								format={percent}
								onChange={(volume) => setMusic({ volume })}
							/>
							<div className="grid grid-cols-2 gap-4">
								<RangeField
									id="video-music-fade-in"
									label="Entrada suave"
									value={draft.music.fadeIn}
									min={0}
									max={5}
									step={0.5}
									format={secondsLabel}
									onChange={(fadeIn) => setMusic({ fadeIn })}
								/>
								<RangeField
									id="video-music-fade-out"
									label="Salida suave"
									value={draft.music.fadeOut}
									min={0}
									max={5}
									step={0.5}
									format={secondsLabel}
									onChange={(fadeOut) => setMusic({ fadeOut })}
								/>
							</div>
						</div>
					) : (
						<Button
							variant="secondary"
							loading={picking}
							onClick={pickMusic}
							className="self-start"
						>
							+ Añadir música
						</Button>
					)}
					{pickError ? (
						<p role="alert" className="mt-2 text-xs text-red-400">
							{pickError}
						</p>
					) : null}
				</Section>

				<Section
					title="Efectos de sonido"
					description="Sutiles: un barrido en cada cambio de escena, un «pop» cuando aparece una cifra y una campanita con la llamada a la acción. Aparecen como pista en la línea de tiempo."
				>
					<div className="flex flex-col gap-4">
						<SwitchField
							label="Efectos de sonido"
							checked={draft.sfx !== null}
							onChange={(on) =>
								setDraft((d) => ({ ...d, sfx: on ? { volume: defaultSfxVolume } : null }))
							}
						/>
						{draft.sfx ? (
							<RangeField
								id="video-sfx-volume"
								label="Volumen de los efectos"
								value={draft.sfx.volume}
								{...volumeRange}
								format={percent}
								onChange={(volume) => setDraft((d) => ({ ...d, sfx: { volume } }))}
							/>
						) : null}
					</div>
				</Section>
			</fieldset>

			<div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-4 rounded-xl bg-zinc-950/90 px-4 py-3 ring-1 ring-white/10 backdrop-blur">
				<p role="status" className="text-xs text-zinc-400">
					{serverError ? (
						<span className="text-red-400">{serverError}</span>
					) : dirty ? (
						"Cambios sin guardar"
					) : null}
				</p>
				<div className="flex gap-2">
					<Button
						variant="ghost"
						disabled={!dirty || saving || locked}
						onClick={() => setDraft(value)}
					>
						Descartar
					</Button>
					<Button type="submit" loading={saving} disabled={!dirty || locked}>
						Guardar ajustes
					</Button>
				</div>
			</div>
		</form>
	);
}

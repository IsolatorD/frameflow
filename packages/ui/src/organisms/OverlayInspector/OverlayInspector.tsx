import { useEffect, useState } from "react";
import { Button } from "../../atoms/Button/Button";
import { RangeField } from "../../atoms/RangeField/RangeField";
import { SelectField } from "../../atoms/SelectField/SelectField";
import { TextField } from "../../atoms/TextField/TextField";
import type { TransitionDraft } from "../../molecules/SceneCard/SceneCardInterface";
import { TRANSITION_OPTIONS } from "../../molecules/SceneStyleFields/SceneStyleFields.constants";
import { Section } from "../../molecules/Section/Section";
import {
	ALIGN_OPTIONS,
	FIT_OPTIONS,
	pct,
	secs,
	times,
	WEIGHT_OPTIONS,
} from "./OverlayInspector.constants";
import type { OverlayDraft, OverlayInspectorProps } from "./OverlayInspectorInterface";

/** Propiedades de la capa seleccionada; los cambios se ven en la vista previa antes de aplicarlos. */
export function OverlayInspector({
	value,
	onApply,
	onDraftChange,
	onDuplicate,
	onDelete,
	colorOptions,
	applying = false,
	serverError,
	locked = false,
}: OverlayInspectorProps) {
	const [draft, setDraft] = useState<OverlayDraft>(value);
	useEffect(() => setDraft(value), [value]);
	const dirty = JSON.stringify(draft) !== JSON.stringify(value);
	useEffect(() => onDraftChange?.(dirty ? draft : null), [dirty, draft, onDraftChange]);

	const set = (patch: Partial<OverlayDraft>) => setDraft((d) => ({ ...d, ...patch }));
	const setTransform = (patch: Partial<OverlayDraft["transform"]>) =>
		setDraft((d) => ({ ...d, transform: { ...d.transform, ...patch } }));
	const setStyle = (patch: Partial<NonNullable<OverlayDraft["style"]>>) =>
		setDraft((d) => (d.style ? { ...d, style: { ...d.style, ...patch } } : d));
	const textEmpty = draft.type === "text" && !draft.text?.trim();

	return (
		<form
			noValidate
			onSubmit={(e) => {
				e.preventDefault();
				if (dirty && !textEmpty) onApply(draft);
			}}
			className="flex flex-col gap-4"
		>
			<fieldset disabled={locked} className="flex flex-col gap-4">
				{draft.type === "text" && draft.style ? (
					<Section title="Texto">
						<div className="flex flex-col gap-4">
							<TextField
								id="overlay-text"
								label="Contenido"
								value={draft.text ?? ""}
								error={textEmpty ? "El texto no puede quedar vacío" : undefined}
								onChange={(text) => set({ text })}
								multiline
							/>
							<RangeField
								id="overlay-font-size"
								label="Tamaño"
								value={draft.style.fontSize}
								min={24}
								max={200}
								step={2}
								format={(v) => `${v} px`}
								onChange={(fontSize) => setStyle({ fontSize })}
							/>
							<div className="grid grid-cols-2 gap-4">
								<SelectField
									id="overlay-color"
									label="Color"
									value={draft.style.color}
									options={colorOptions}
									onChange={(color) => setStyle({ color })}
								/>
								<SelectField
									id="overlay-background"
									label="Fondo"
									value={draft.style.background ?? ""}
									options={[{ value: "", label: "Sin fondo" }, ...colorOptions]}
									onChange={(background) => setStyle({ background: background || undefined })}
								/>
								<SelectField
									id="overlay-weight"
									label="Grosor"
									value={String(draft.style.fontWeight)}
									options={WEIGHT_OPTIONS}
									onChange={(w) => setStyle({ fontWeight: Number(w) })}
								/>
								<SelectField
									id="overlay-align"
									label="Alineación"
									value={draft.style.align}
									options={ALIGN_OPTIONS}
									onChange={(align) => setStyle({ align: align as "left" | "center" | "right" })}
								/>
							</div>
						</div>
					</Section>
				) : (
					<Section title={draft.type === "image" ? "Imagen" : "Video"} description={draft.label}>
						<div className="flex flex-col gap-4">
							<SelectField
								id="overlay-fit"
								label="Encaje"
								value={draft.fit ?? "contain"}
								options={FIT_OPTIONS}
								onChange={(fit) => set({ fit: fit as "cover" | "contain" })}
							/>
							{draft.type === "video" ? (
								<>
									<RangeField
										id="overlay-volume"
										label="Volumen del clip"
										value={draft.volume ?? 0}
										min={0}
										max={1}
										step={0.05}
										format={(v) => (v === 0 ? "Silenciado" : pct(v))}
										onChange={(volume) => set({ volume })}
									/>
									{draft.sourceDuration ? (
										<RangeField
											id="overlay-trim-start"
											label="Empezar el clip en"
											value={draft.trimStart ?? 0}
											min={0}
											max={Math.max(0, Math.floor((draft.sourceDuration - 0.5) * 10) / 10)}
											step={0.1}
											format={secs}
											onChange={(trimStart) => set({ trimStart })}
										/>
									) : null}
								</>
							) : null}
						</div>
					</Section>
				)}

				<Section title="Posición y aspecto">
					<div className="grid grid-cols-2 gap-4">
						<RangeField
							id="overlay-x"
							label="Horizontal"
							value={draft.transform.x}
							min={0}
							max={1}
							step={0.01}
							format={pct}
							onChange={(x) => setTransform({ x })}
						/>
						<RangeField
							id="overlay-y"
							label="Vertical"
							value={draft.transform.y}
							min={0}
							max={1}
							step={0.01}
							format={pct}
							onChange={(y) => setTransform({ y })}
						/>
						<RangeField
							id="overlay-scale"
							label="Escala"
							value={draft.transform.scale}
							min={0.1}
							max={2}
							step={0.05}
							format={times}
							onChange={(scale) => setTransform({ scale })}
						/>
						<RangeField
							id="overlay-opacity"
							label="Opacidad"
							value={draft.transform.opacity}
							min={0}
							max={1}
							step={0.05}
							format={pct}
							onChange={(opacity) => setTransform({ opacity })}
						/>
						<RangeField
							id="overlay-rotation"
							label="Rotación"
							value={draft.transform.rotation}
							min={-45}
							max={45}
							step={1}
							format={(v) => `${v}°`}
							onChange={(rotation) => setTransform({ rotation })}
						/>
					</div>
				</Section>

				<Section title="Transiciones">
					<div className="grid grid-cols-2 gap-4">
						<SelectField
							id="overlay-enter"
							label="Entrada"
							value={draft.enter}
							options={TRANSITION_OPTIONS}
							onChange={(v) => set({ enter: v as TransitionDraft })}
						/>
						<SelectField
							id="overlay-exit"
							label="Salida"
							value={draft.exit}
							options={TRANSITION_OPTIONS}
							onChange={(v) => set({ exit: v as TransitionDraft })}
						/>
					</div>
				</Section>
			</fieldset>

			<div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-3 rounded-xl bg-zinc-950/90 px-4 py-3 ring-1 ring-white/10 backdrop-blur">
				<div className="flex gap-1">
					<Button
						variant="ghost"
						disabled={locked || dirty}
						onClick={onDuplicate}
						title="Duplicar (⌘D)"
					>
						Duplicar
					</Button>
					<Button
						variant="ghost"
						disabled={locked}
						onClick={onDelete}
						title="Eliminar (⌫)"
						className="text-red-300 hover:text-red-200"
					>
						Eliminar
					</Button>
				</div>
				<div className="flex items-center gap-2">
					{serverError ? (
						<span role="alert" className="text-xs text-red-400">
							{serverError}
						</span>
					) : null}
					<Button variant="ghost" disabled={!dirty || applying} onClick={() => setDraft(value)}>
						Descartar
					</Button>
					<Button type="submit" loading={applying} disabled={!dirty || textEmpty || locked}>
						Aplicar
					</Button>
				</div>
			</div>
		</form>
	);
}

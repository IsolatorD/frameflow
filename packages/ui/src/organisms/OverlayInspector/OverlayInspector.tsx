import { Button } from "../../atoms/Button/Button";
import { RangeField } from "../../atoms/RangeField/RangeField";
import { SelectField } from "../../atoms/SelectField/SelectField";
import { SwitchField } from "../../atoms/SwitchField/SwitchField";
import { TextField } from "../../atoms/TextField/TextField";
import type { TransitionDraft } from "../../molecules/SceneCard/SceneCardInterface";
import { TRANSITION_OPTIONS } from "../../molecules/SceneStyleFields/SceneStyleFields.constants";
import { Section } from "../../molecules/Section/Section";
import {
	ALIGN_OPTIONS,
	EASING_OPTIONS,
	FIT_OPTIONS,
	pct,
	secs,
	times,
	WEIGHT_OPTIONS,
} from "./OverlayInspector.constants";
import type { EasingDraft, OverlayDraft, OverlayInspectorProps } from "./OverlayInspectorInterface";

/** Propiedades de la capa seleccionada; los cambios se ven en la vista previa antes de aplicarlos. */
export function OverlayInspector({
	value,
	animation,
	draft: draftProp,
	onDraftChange,
	onApply,
	onDuplicate,
	onDelete,
	colorOptions,
	applying = false,
	serverError,
	locked = false,
}: OverlayInspectorProps) {
	const draft = draftProp ?? value;
	const dirty = draftProp !== null && JSON.stringify(draftProp) !== JSON.stringify(value);
	// Un borrador igual a lo guardado no es un cambio.
	const setDraft = (next: OverlayDraft) =>
		onDraftChange(JSON.stringify(next) === JSON.stringify(value) ? null : next);

	const set = (patch: Partial<OverlayDraft>) => setDraft({ ...draft, ...patch });
	const setTransform = (patch: Partial<OverlayDraft["transform"]>) =>
		setDraft({ ...draft, transform: { ...draft.transform, ...patch } });
	const setStyle = (patch: Partial<NonNullable<OverlayDraft["style"]>>) => {
		if (draft.style) setDraft({ ...draft, style: { ...draft.style, ...patch } });
	};
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

				{animation ? (
					<Section
						title="Animación"
						description="Fotogramas clave: la capa pasa de uno a otro con una curva suave."
					>
						<div className="flex flex-col gap-3">
							<SwitchField
								label="Animar con fotogramas clave"
								description="Mueve el cabezal y cambia posición, escala, giro u opacidad: cada cambio crea un fotograma en ese instante."
								checked={animation.enabled}
								onChange={animation.onToggle}
							/>
							{animation.enabled ? (
								<>
									<div className="flex flex-wrap items-center gap-2">
										<span className="text-xs text-zinc-400">
											{animation.inside
												? `Cabezal en ${secs(animation.time)} de la capa`
												: "El cabezal está fuera de esta capa"}
										</span>
										{animation.keyframes.some((k) => k.current) ? (
											<Button variant="ghost" onClick={animation.onRemoveHere}>
												Quitar este fotograma
											</Button>
										) : (
											<Button
												variant="secondary"
												disabled={!animation.inside}
												onClick={animation.onAddHere}
											>
												◆ Fotograma aquí
											</Button>
										)}
									</div>
									{animation.current ? (
										<SelectField
											id="overlay-easing"
											label="Curva hasta este fotograma"
											value={animation.current.easing}
											options={EASING_OPTIONS}
											onChange={(v) => animation.onEasingChange(v as EasingDraft)}
											hint={
												animation.current.first
													? "Es el primer fotograma: la curva se usará si añades otro antes."
													: "Cómo se mueve la capa desde el fotograma anterior hasta este."
											}
										/>
									) : null}
									<ul aria-label="Fotogramas clave" className="flex flex-wrap gap-1.5">
										{animation.keyframes.map((k) => (
											<li key={k.at}>
												<button
													type="button"
													aria-pressed={k.current}
													title="Ir a este fotograma"
													onClick={() => animation.onSeek(k.at)}
													className={`rounded-full px-2.5 py-1 font-mono text-xs ring-1 ${
														k.current
															? "bg-violet-500/20 text-violet-100 ring-violet-400"
															: "text-zinc-300 ring-white/10 hover:bg-white/5"
													}`}
												>
													◆ {secs(k.at)}
												</button>
											</li>
										))}
									</ul>
								</>
							) : null}
						</div>
					</Section>
				) : null}

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
					<Button variant="ghost" disabled={!dirty || applying} onClick={() => onDraftChange(null)}>
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

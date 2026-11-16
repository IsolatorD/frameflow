import { Button } from "../../atoms/Button/Button";
import { SelectField } from "../../atoms/SelectField/SelectField";
import { TextField } from "../../atoms/TextField/TextField";
import { convertContent, MAX_LINES, SCENE_TYPES } from "./SceneCard.constants";
import type { SceneCardProps, SceneContentDraft } from "./SceneCardInterface";

/** Una escena del guion: lo que dice la voz y lo que se ve. */
export function SceneCard({
	id,
	index,
	total,
	scene,
	onChange,
	onMove,
	onRemove,
	estimate,
	disabled = false,
}: SceneCardProps) {
	const setContent = (content: SceneContentDraft) => onChange({ ...scene, content });
	const { content } = scene;

	return (
		<fieldset
			disabled={disabled}
			className="flex flex-col gap-4 rounded-2xl bg-white/[0.02] p-4 ring-1 ring-white/10"
		>
			<legend className="sr-only">Escena {index + 1}</legend>
			<div className="flex items-center justify-between gap-3">
				<span className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
					<span className="flex size-6 items-center justify-center rounded-full bg-white/10 text-xs">
						{index + 1}
					</span>
					Escena {index + 1}
					<span className="text-xs font-normal text-zinc-500">≈ {estimate}</span>
				</span>
				<div className="flex gap-1">
					<Button
						variant="ghost"
						aria-label={`Subir escena ${index + 1}`}
						disabled={index === 0}
						onClick={() => onMove(-1)}
						className="px-2"
					>
						↑
					</Button>
					<Button
						variant="ghost"
						aria-label={`Bajar escena ${index + 1}`}
						disabled={index === total - 1}
						onClick={() => onMove(1)}
						className="px-2"
					>
						↓
					</Button>
					<Button
						variant="ghost"
						aria-label={`Eliminar escena ${index + 1}`}
						disabled={total === 1}
						onClick={onRemove}
						className="px-2"
					>
						✕
					</Button>
				</div>
			</div>

			<TextField
				id={`${id}-narration`}
				label="Narración"
				value={scene.narration}
				onChange={(narration) => onChange({ ...scene, narration })}
				hint="Lo que dice la voz. Escribe los números con letras."
				multiline
			/>

			<div className="grid grid-cols-[180px_1fr] gap-4">
				<SelectField
					id={`${id}-type`}
					label="En pantalla"
					value={content.type}
					options={SCENE_TYPES}
					onChange={(type) =>
						setContent(convertContent(content, type as SceneContentDraft["type"]))
					}
				/>
				{content.type === "kinetic-text" ? (
					<div className="flex flex-col gap-2">
						{content.lines.map((line, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: las líneas no tienen id; se editan en su posición
								key={i}
								className="flex items-end gap-2"
							>
								<div className="flex-1">
									<TextField
										id={`${id}-line-${i}`}
										label={`Línea ${i + 1}`}
										value={line.text}
										maxLength={30}
										onChange={(text) =>
											setContent({
												...content,
												lines: content.lines.map((l, j) => (j === i ? { ...l, text } : l)),
											})
										}
									/>
								</div>
								<Button
									variant={line.emphasis ? "secondary" : "ghost"}
									aria-pressed={Boolean(line.emphasis)}
									aria-label={`Destacar línea ${i + 1}`}
									onClick={() =>
										setContent({
											...content,
											lines: content.lines.map((l, j) =>
												j === i ? { ...l, emphasis: !l.emphasis } : l,
											),
										})
									}
								>
									★
								</Button>
								<Button
									variant="ghost"
									aria-label={`Quitar línea ${i + 1}`}
									disabled={content.lines.length === 1}
									onClick={() =>
										setContent({ ...content, lines: content.lines.filter((_, j) => j !== i) })
									}
									className="px-2"
								>
									✕
								</Button>
							</div>
						))}
						{content.lines.length < MAX_LINES ? (
							<Button
								variant="ghost"
								className="self-start"
								onClick={() => setContent({ ...content, lines: [...content.lines, { text: "" }] })}
							>
								+ Línea
							</Button>
						) : null}
					</div>
				) : (
					<div className="grid grid-cols-[1fr_1fr_2fr] gap-3">
						<TextField
							id={`${id}-value`}
							label="Cifra"
							type="number"
							value={Number.isFinite(content.value) ? String(content.value) : ""}
							onChange={(v) => setContent({ ...content, value: v === "" ? 0 : Number(v) })}
						/>
						<TextField
							id={`${id}-suffix`}
							label="Unidad"
							placeholder=" min"
							value={content.suffix ?? ""}
							maxLength={8}
							onChange={(suffix) => setContent({ ...content, suffix })}
						/>
						<TextField
							id={`${id}-label`}
							label="Explicación"
							value={content.label}
							maxLength={40}
							onChange={(label) => setContent({ ...content, label })}
						/>
					</div>
				)}
			</div>
		</fieldset>
	);
}

import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { SelectField } from "../../atoms/SelectField/SelectField";
import { TextField } from "../../atoms/TextField/TextField";
import { SceneStyleFields } from "../SceneStyleFields/SceneStyleFields";
import {
	convertContent,
	ITEM_COLUMNS,
	ITEMS,
	type ItemRow,
	MAX_LINES,
	rowsOf,
	SCENE_TYPES,
	withRows,
} from "./SceneCard.constants";
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
	defaultTheme,
	extraTimeRange,
	voiced,
	recorded,
	onRecord,
	recordDisabledReason,
	highlighted = false,
}: SceneCardProps) {
	const setContent = (content: SceneContentDraft) => onChange({ ...scene, content });
	const { content } = scene;

	return (
		<fieldset
			id={`${id}-card`}
			disabled={disabled}
			className={`flex scroll-mt-4 flex-col gap-4 rounded-2xl bg-white/[0.02] p-4 ring-1 transition-shadow ${
				highlighted ? "ring-2 ring-violet-400" : "ring-white/10"
			}`}
		>
			<legend className="sr-only">Escena {index + 1}</legend>
			<div className="flex items-center justify-between gap-3">
				<span className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
					<span className="flex size-6 items-center justify-center rounded-full bg-white/10 text-xs">
						{index + 1}
					</span>
					Escena {index + 1}
					<span className="text-xs font-normal text-zinc-500">≈ {estimate}</span>
					{voiced === false ? <Badge tone="warning">Sin voz</Badge> : null}
					{recorded ? <Badge tone="info">Voz grabada</Badge> : null}
				</span>
				<div className="flex gap-1">
					{onRecord ? (
						<Button
							variant="ghost"
							aria-label={`Grabar la voz de la escena ${index + 1}`}
							title={recordDisabledReason ?? "Grabar tu voz para esta escena"}
							disabled={disabled || Boolean(recordDisabledReason)}
							onClick={onRecord}
							className="px-2"
						>
							🎙 Grabar
						</Button>
					) : null}
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
				) : content.type === "stat" ? (
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
				) : (
					<ItemsEditor id={id} content={content} onChange={setContent} />
				)}
			</div>
			<details className="group rounded-xl bg-white/[0.02] ring-1 ring-white/5">
				<summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-zinc-400 select-none hover:text-zinc-200 [&::-webkit-details-marker]:hidden">
					<span className="inline-block transition-transform group-open:rotate-90">›</span> Estilo
					de la escena
				</summary>
				<div className="px-3 pt-1 pb-3">
					<SceneStyleFields
						idPrefix={id}
						settings={scene.settings ?? {}}
						onChange={(settings) => onChange({ ...scene, settings })}
						defaultTheme={defaultTheme}
						extraTimeRange={extraTimeRange}
					/>
				</div>
			</details>
		</fieldset>
	);
}

type ListContent = Extract<SceneContentDraft, { type: "steps" | "timeline" | "compare" | "chart" }>;

/** Editor de pasos, hitos, lados de la comparación o barras del gráfico. */
function ItemsEditor({
	id,
	content,
	onChange,
}: {
	id: string;
	content: ListContent;
	onChange: (content: SceneContentDraft) => void;
}) {
	const cols = ITEM_COLUMNS[content.type];
	const rows = rowsOf(content);
	const fixed = content.type === "compare";
	const setRows = (next: ItemRow[]) => onChange(withRows(content, next));
	const setRow = (i: number, patch: Partial<ItemRow>) =>
		setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
	return (
		<div className="flex flex-col gap-2">
			<div className={content.type === "chart" ? "grid grid-cols-[2fr_1fr] gap-3" : ""}>
				<TextField
					id={`${id}-title`}
					label="Título (opcional)"
					value={content.title ?? ""}
					maxLength={40}
					onChange={(title) => onChange({ ...content, title: title || undefined })}
				/>
				{content.type === "chart" ? (
					<TextField
						id={`${id}-chart-suffix`}
						label="Unidad"
						placeholder=" km"
						value={content.suffix ?? ""}
						maxLength={8}
						onChange={(suffix) => onChange({ ...content, suffix })}
					/>
				) : null}
			</div>
			{rows.map((row, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: los elementos no tienen id; se editan en su posición
					key={i}
					className="flex items-end gap-2"
				>
					<div className={cols.b ? (cols.numeric ? "flex-[2]" : "w-36 shrink-0") : "flex-1"}>
						<TextField
							id={`${id}-item-${i}-a`}
							label={`${cols.a} ${i + 1}`}
							value={row.a}
							maxLength={content.type === "timeline" ? 16 : 40}
							onChange={(a) => setRow(i, { a })}
						/>
					</div>
					{cols.b ? (
						<div className="flex-1">
							<TextField
								id={`${id}-item-${i}-b`}
								label={cols.b}
								value={row.b}
								maxLength={40}
								onChange={(b) => setRow(i, { b })}
							/>
						</div>
					) : null}
					{fixed ? null : (
						<Button
							variant="ghost"
							aria-label={`Quitar ${cols.item} ${i + 1}`}
							disabled={rows.length <= ITEMS.min}
							onClick={() => setRows(rows.filter((_, j) => j !== i))}
							className="px-2"
						>
							✕
						</Button>
					)}
				</div>
			))}
			{!fixed && rows.length < ITEMS.max ? (
				<Button
					variant="ghost"
					className="self-start"
					onClick={() => setRows([...rows, { a: "", b: "" }])}
				>
					+ {cols.item.charAt(0).toUpperCase() + cols.item.slice(1)}
				</Button>
			) : null}
		</div>
	);
}

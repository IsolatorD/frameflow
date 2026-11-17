import { useState } from "react";
import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { TextField } from "../../atoms/TextField/TextField";
import { Tabs } from "../../molecules/Tabs/Tabs";
import type { PublishItem, PublishPanelProps } from "./PublishPanelInterface";

/** Pestaña "Publicar": el texto de cada red, comprobaciones y exportar para subir a mano. */
export function PublishPanel(props: PublishPanelProps) {
	const { items, active, onActiveChange, onImprove, improving, aiNote, aiAvailable, error } = props;
	const item = items.find((i) => i.id === active) ?? items[0];
	if (!item) return null;
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.02] p-4 ring-1 ring-white/10">
				<div>
					<p className="text-sm font-medium text-zinc-100">Sube el video a cada red</p>
					<p className="text-xs text-zinc-500">
						Aquí tienes el texto de cada una, la portada y el MP4 listos. La conexión directa con
						las redes llega más adelante.
					</p>
				</div>
				<div className="flex flex-col items-end gap-1">
					<Button
						variant="secondary"
						onClick={onImprove}
						loading={improving}
						disabled={!aiAvailable}
					>
						Mejorar textos con IA
					</Button>
					<span className="text-[11px] text-zinc-500">{aiNote}</span>
				</div>
			</div>
			<Tabs
				label="Red social"
				idPrefix="publish"
				tabs={items.map((i) => ({
					id: i.id,
					label: i.label,
					badge: i.status === "published" ? "✓" : i.status === "exported" ? "●" : undefined,
				}))}
				active={item.id}
				onChange={onActiveChange}
			/>
			<div
				id={`publish-panel-${item.id}`}
				role="tabpanel"
				aria-labelledby={`publish-tab-${item.id}`}
			>
				<PostCard key={item.id} item={item} {...props} />
			</div>
			{error ? (
				<p role="alert" className="text-sm text-red-400">
					{error}
				</p>
			) : null}
		</div>
	);
}

function PostCard({
	item,
	onChange,
	parseHashtags,
	onCopy,
	onExport,
	onOpenUpload,
	onReveal,
	onMarkPublished,
	exporting,
	copied,
	saving,
}: PublishPanelProps & { item: PublishItem }) {
	const [tagsText, setTagsText] = useState(item.post.hashtags.join(" "));
	const [url, setUrl] = useState("");
	const post = item.post;
	const errors = item.issues.filter((i) => i.level === "error");
	const over = item.composedLength > item.captionMax;
	return (
		<div className="flex flex-col gap-4 rounded-2xl bg-white/[0.02] p-5 ring-1 ring-white/10">
			{item.titleMax !== null ? (
				<TextField
					id={`publish-title-${item.id}`}
					label="Título"
					value={post.title}
					onChange={(title) => onChange(item.id, { ...post, title })}
					hint={`${post.title.length}/${item.titleMax}`}
				/>
			) : null}
			<div className="flex flex-col gap-1.5">
				<TextField
					id={`publish-caption-${item.id}`}
					label={item.titleMax !== null ? "Descripción" : "Texto"}
					multiline
					value={post.caption}
					onChange={(caption) => onChange(item.id, { ...post, caption })}
				/>
				<p className={`text-xs ${over ? "text-red-400" : "text-zinc-500"}`}>
					{item.composedLength}/{item.captionMax} con hashtags · se ven los primeros{" "}
					{item.captionVisible} caracteres: pon ahí el gancho.
				</p>
			</div>
			<TextField
				id={`publish-hashtags-${item.id}`}
				label="Hashtags"
				value={tagsText}
				onChange={(text) => {
					setTagsText(text);
					onChange(item.id, { ...post, hashtags: parseHashtags(text) });
				}}
				placeholder="#astronomía #espacio"
				hint={`${post.hashtags.length} · se recomiendan ${item.hashtagsRecommended} o menos.${item.note ? ` ${item.note}` : ""}`}
			/>
			{item.issues.length ? (
				<ul className="flex flex-col gap-1">
					{item.issues.map((issue) => (
						<li
							key={issue.message}
							className={`text-xs ${issue.level === "error" ? "text-red-400" : "text-amber-300"}`}
						>
							{issue.level === "error" ? "✕" : "!"} {issue.message}
						</li>
					))}
				</ul>
			) : null}

			<div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-4">
				<Button variant="secondary" onClick={() => onCopy(item.id)}>
					Copiar texto
				</Button>
				<Button
					onClick={() => onExport(item.id)}
					loading={exporting === item.id}
					disabled={errors.length > 0 || (exporting !== null && exporting !== item.id)}
				>
					{item.exportPath ? "Exportar de nuevo" : "Exportar"}
				</Button>
				{item.exportPath ? (
					<>
						<Button variant="ghost" onClick={() => onReveal(item.exportPath as string)}>
							Mostrar carpeta
						</Button>
						<Button variant="ghost" onClick={() => onOpenUpload(item.id)}>
							Abrir {item.uploadLabel}
						</Button>
					</>
				) : null}
				<span role="status" className="text-xs text-zinc-500">
					{copied ?? (saving ? "Guardando…" : "")}
				</span>
			</div>
			{item.exportPath ? (
				<p className="text-xs text-zinc-500">
					{item.exportOutdated ? (
						<span className="text-amber-300">
							La carpeta exportada es de una versión anterior del video. Expórtalo de nuevo.{" "}
						</span>
					) : null}
					En la carpeta: el MP4, la portada (portada.jpg) y texto.txt con lo que hay que pegar.
				</p>
			) : null}

			{item.status === "published" ? (
				<div className="flex flex-wrap items-center gap-3">
					<Badge tone="success">Publicado</Badge>
					{item.url ? (
						<a
							href={item.url}
							target="_blank"
							rel="noreferrer"
							className="truncate text-xs text-violet-300 underline"
						>
							{item.url}
						</a>
					) : null}
					<Button variant="ghost" onClick={() => onMarkPublished(item.id, null)}>
						Deshacer
					</Button>
				</div>
			) : item.exportPath ? (
				<form
					className="flex flex-col gap-1.5"
					onSubmit={(e) => {
						e.preventDefault();
						if (url.trim()) onMarkPublished(item.id, url.trim());
					}}
				>
					<div className="flex items-end gap-3">
						<div className="flex-1">
							<TextField
								id={`publish-url-${item.id}`}
								label="¿Ya lo publicaste? Pega el enlace"
								value={url}
								onChange={setUrl}
								placeholder="https://"
							/>
						</div>
						<Button type="submit" variant="secondary" disabled={!url.trim()}>
							Marcar como publicado
						</Button>
					</div>
					<p className="text-xs text-zinc-500">
						Sirve para seguir sus estadísticas cuando conectes la cuenta.
					</p>
				</form>
			) : null}
		</div>
	);
}

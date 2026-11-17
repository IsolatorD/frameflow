import { type ReactNode, useState } from "react";
import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { SelectField } from "../../atoms/SelectField/SelectField";
import { TextField } from "../../atoms/TextField/TextField";
import { ChoiceCard } from "../../molecules/ChoiceCard/ChoiceCard";
import { Section } from "../../molecules/Section/Section";
import type { AiProviderOption, AiSettingsPanelProps } from "./AiSettingsPanelInterface";

const CUSTOM = "__custom__";
const OLLAMA_DOWNLOAD = "https://ollama.com/download";

/** Ajustes de la IA que escribe los guiones: proveedor, modelo, clave y prueba de conexión. */
export function AiSettingsPanel(props: AiSettingsPanelProps) {
	const { providers, provider, onProviderChange, error } = props;
	const current = providers.find((p) => p.id === provider) ?? providers[0];
	if (!current) return null;

	return (
		<div className="flex max-w-3xl flex-col gap-5">
			<Section
				title="¿Quién escribe los guiones?"
				description="La IA solo se usa en el modo automático. Puedes cambiarla cuando quieras."
			>
				<fieldset>
					<legend className="sr-only">Proveedor de IA</legend>
					<div className="grid grid-cols-2 gap-3">
						{providers.map((p) => (
							<ChoiceCard
								key={p.id}
								name="ai-provider"
								value={p.id}
								title={p.label}
								description={p.description}
								selected={p.id === current.id}
								onSelect={onProviderChange}
							/>
						))}
					</div>
				</fieldset>
				{error ? (
					<p role="alert" className="mt-3 text-sm text-red-400">
						{error}
					</p>
				) : null}
			</Section>

			{current.cloud ? (
				<CloudSettings key={current.id} {...props} current={current} />
			) : (
				<LocalSettings {...props} current={current} />
			)}
		</div>
	);
}

type Inner = AiSettingsPanelProps & { current: AiProviderOption };

function LocalSettings({
	current,
	model,
	onModelChange,
	local,
	onPrepare,
	onCancelPrepare,
	onDismissPrepare,
	...rest
}: Inner) {
	const isInstalled = (id: string) => local.installed.includes(id);
	const ready = local.running && isInstalled(model);
	const label = current.models.find((m) => m.id === model)?.label ?? model;
	const job = local.job;
	return (
		<Section
			title="Modelo en este equipo"
			description="Se ejecuta con Ollama: no necesita cuenta y el tema del video no sale de tu equipo."
		>
			<div className="flex flex-col gap-4">
				<ModelPicker
					current={current}
					model={model}
					onModelChange={onModelChange}
					extra={local.installed.filter((id) => !current.models.some((m) => m.id === id))}
					badge={(id) => (isInstalled(id) ? "Descargado" : (local.modelSize(id) ?? "Descargado"))}
				/>
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<p className="text-xs text-zinc-400">
						<span className="font-medium text-zinc-300">Para tu equipo: </span>
						{local.recommendation.text}
					</p>
					{local.recommendation.model && local.recommendation.model !== model ? (
						<button
							type="button"
							onClick={() => onModelChange(local.recommendation.model as string)}
							className="text-xs text-violet-300 underline-offset-2 hover:underline"
						>
							Usar el recomendado
						</button>
					) : null}
				</div>

				{job && job.status !== "done" ? (
					<PrepareProgress
						job={job}
						onCancel={onCancelPrepare}
						onDismiss={onDismissPrepare}
						onRetry={() => onPrepare(model)}
					/>
				) : ready ? (
					<>
						{job?.status === "done" ? (
							<Notice tone="success" onDismiss={onDismissPrepare}>
								Listo: {job.modelLabel} está descargado y preparado.
							</Notice>
						) : null}
						<p className="text-xs text-zinc-500">
							{local.engine === "managed"
								? "Usando el Ollama que descargó Frameflow (se abre y se cierra con la app)."
								: "Usando el Ollama instalado en tu equipo."}
						</p>
						<TestRow
							{...rest}
							local={local}
							model={model}
							current={current}
							onModelChange={onModelChange}
							onPrepare={onPrepare}
							onCancelPrepare={onCancelPrepare}
							onDismissPrepare={onDismissPrepare}
						/>
					</>
				) : (
					<PrepareOffer local={local} model={model} label={label} onPrepare={onPrepare} />
				)}
			</div>
		</Section>
	);
}

/** Qué falta y cuánto ocupa; el botón es la confirmación. */
function PrepareOffer({
	local,
	model,
	label,
	onPrepare,
}: {
	local: Inner["local"];
	model: string;
	label: string;
	onPrepare: (model: string) => void;
}) {
	const needsRuntime = local.engine === "missing";
	const modelSize = local.modelSize(model);
	const space = local.spaceWarning(model);
	if (needsRuntime && !local.runtimeSize) {
		return (
			<Notice tone="warning">
				No hay una versión de Ollama para este equipo. Usa un proveedor en la nube o instala Ollama
				desde{" "}
				<a href={OLLAMA_DOWNLOAD} target="_blank" rel="noreferrer" className="underline">
					ollama.com/download
				</a>
				.
			</Notice>
		);
	}
	// Sin tamaño = el modelo ya está en disco: solo falta Ollama.
	const parts = [
		needsRuntime ? `Ollama (${local.runtimeSize})` : null,
		modelSize || !needsRuntime ? `${label}${modelSize ? ` (${modelSize})` : ""}` : null,
	].filter(Boolean);
	return (
		<div className="flex flex-col gap-3 rounded-xl bg-violet-500/5 p-4 ring-1 ring-violet-400/20">
			<div>
				<p className="text-sm font-medium text-zinc-100">
					{needsRuntime ? "Preparar la IA en este equipo" : `${label} aún no está descargado`}
				</p>
				<p className="mt-1 text-xs text-zinc-400">
					Se descargará {parts.join(" y ")}. Es una sola vez: después funciona sin internet.
					{needsRuntime
						? " Ollama se guarda dentro de la carpeta de Frameflow; no se instala nada en el sistema."
						: ""}
					{local.freeSpace ? ` Espacio libre: ${local.freeSpace}.` : ""}
				</p>
			</div>
			{space ? <p className="text-xs text-amber-300">{space}</p> : null}
			<Button className="self-start" onClick={() => onPrepare(model)}>
				{needsRuntime ? "Descargar y preparar" : `Descargar ${label}`}
			</Button>
		</div>
	);
}

function PrepareProgress({
	job,
	onCancel,
	onDismiss,
	onRetry,
}: {
	job: NonNullable<Inner["local"]["job"]>;
	onCancel: () => void;
	onDismiss: () => void;
	onRetry: () => void;
}) {
	const running = job.status === "running";
	return (
		<section
			aria-label={`Preparando ${job.modelLabel}`}
			className="flex flex-col gap-3 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10"
		>
			<ol className="flex flex-col gap-3">
				{job.steps.map((step) => (
					<li key={step.id} className="flex flex-col gap-1.5">
						<div className="flex items-center gap-2 text-sm">
							<span
								aria-hidden="true"
								className={`size-2 rounded-full ${
									step.state === "done"
										? "bg-emerald-400"
										: step.state === "active"
											? running
												? "animate-pulse bg-violet-400"
												: "bg-red-400"
											: "bg-zinc-600"
								}`}
							/>
							<span className={step.state === "pending" ? "text-zinc-500" : "text-zinc-200"}>
								{step.label}
							</span>
							{step.state === "done" ? <span className="text-xs text-zinc-500">Hecho</span> : null}
						</div>
						{step.state === "active" && step.fraction !== undefined ? (
							<div
								role="progressbar"
								aria-label={step.label}
								aria-valuemin={0}
								aria-valuemax={100}
								aria-valuenow={Math.round(step.fraction * 100)}
								className="h-1.5 overflow-hidden rounded-full bg-white/10"
							>
								<div
									className="h-full rounded-full bg-violet-400 transition-[width]"
									style={{ width: `${Math.round(step.fraction * 100)}%` }}
								/>
							</div>
						) : null}
						{step.state === "active" && step.detail ? (
							<p className="text-xs text-zinc-500">{step.detail}</p>
						) : null}
					</li>
				))}
			</ol>
			{job.notice && running ? <p className="text-xs text-amber-300">{job.notice}</p> : null}
			{job.status === "error" ? (
				<p role="alert" className="text-sm text-red-400">
					{job.error}
				</p>
			) : null}
			{job.status === "cancelled" ? (
				<p className="text-sm text-zinc-400">Descarga cancelada. Lo descargado se conserva.</p>
			) : null}
			<div className="flex gap-3">
				{running ? (
					<Button variant="secondary" onClick={onCancel}>
						Cancelar
					</Button>
				) : (
					<>
						<Button onClick={onRetry}>{job.status === "error" ? "Reintentar" : "Continuar"}</Button>
						<Button variant="ghost" onClick={onDismiss}>
							Cerrar
						</Button>
					</>
				)}
			</div>
		</section>
	);
}

function CloudSettings(props: Inner) {
	const { current, model, onModelChange, apiKey, keyStorage } = props;
	return (
		<Section
			title={current.label}
			description={`El tema, el tono y el nombre del canal se envían a ${current.label} para escribir el guion. Pagas el uso en tu cuenta (unos céntimos por guion).`}
		>
			<div className="flex flex-col gap-4">
				{keyStorage === "weak" ? (
					<Notice tone="warning">
						Tu sistema no tiene un llavero (GNOME Keyring o KWallet): la clave se guardará sin
						cifrado fuerte en este equipo.
					</Notice>
				) : null}
				{keyStorage === "unavailable" ? (
					<Notice tone="warning">
						Este sistema no permite guardar claves cifradas. Instala un llavero para usar un
						proveedor en la nube.
					</Notice>
				) : null}
				<KeyField {...props} />
				<ModelPicker current={current} model={model} onModelChange={onModelChange} />
				{apiKey?.set ? <TestRow {...props} /> : null}
			</div>
		</Section>
	);
}

function KeyField({
	current,
	apiKey,
	keyWarning,
	onSaveKey,
	onRemoveKey,
	keySaving,
	keyError,
	keyStorage,
}: Inner) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState("");
	const id = `ai-key-${current.id}`;
	const createLink = current.keyUrl ? (
		<a href={current.keyUrl} target="_blank" rel="noreferrer" className="underline">
			Crear una clave
		</a>
	) : null;

	if (apiKey?.set && !editing) {
		return (
			<div className="flex flex-col gap-1.5">
				<span className="text-sm font-medium text-zinc-200">Clave de API</span>
				<div className="flex items-center gap-3">
					<Badge tone="success">Guardada</Badge>
					<span className="font-mono text-sm text-zinc-300">{apiKey.hint}</span>
					<Button variant="ghost" onClick={() => setEditing(true)}>
						Cambiar
					</Button>
					<Button variant="ghost" onClick={onRemoveKey} disabled={keySaving}>
						Quitar
					</Button>
				</div>
				<p className="text-xs text-zinc-500">
					Cifrada con el almacén de claves del sistema. Frameflow no la muestra ni la envía a ningún
					sitio salvo a {current.label}.
				</p>
				{keyError ? <p className="text-xs text-red-400">{keyError}</p> : null}
			</div>
		);
	}

	const warning = draft ? keyWarning?.(draft) : null;
	return (
		<form
			className="flex flex-col gap-2"
			onSubmit={(e) => {
				e.preventDefault();
				if (!draft.trim()) return;
				onSaveKey(draft.trim());
				setDraft("");
				setEditing(false);
			}}
		>
			<TextField
				id={id}
				label="Clave de API"
				type="password"
				value={draft}
				onChange={setDraft}
				placeholder="Pega aquí tu clave"
				error={keyError}
				hint={warning ?? undefined}
				disabled={keyStorage === "unavailable"}
			/>
			<div className="flex items-center gap-3">
				<Button
					type="submit"
					loading={keySaving}
					disabled={!draft.trim() || keyStorage === "unavailable"}
				>
					Guardar clave
				</Button>
				{editing ? (
					<Button variant="ghost" onClick={() => setEditing(false)}>
						Cancelar
					</Button>
				) : null}
				<span className="text-xs text-zinc-500">{createLink}</span>
			</div>
		</form>
	);
}

function ModelPicker({
	current,
	model,
	onModelChange,
	extra = [],
	badge,
}: {
	current: AiProviderOption;
	model: string;
	onModelChange: (model: string) => void;
	extra?: readonly string[];
	badge?: (id: string) => string | null;
}) {
	const known = [...current.models.map((m) => m.id), ...extra];
	const [custom, setCustom] = useState(!known.includes(model));
	const [customDraft, setCustomDraft] = useState(known.includes(model) ? "" : model);
	const withBadge = (id: string, label: string) => {
		const b = badge?.(id);
		return b ? `${label} · ${b}` : label;
	};
	const options = [
		...current.models.map((m) => ({ value: m.id, label: withBadge(m.id, m.label) })),
		...extra.map((id) => ({ value: id, label: withBadge(id, id) })),
		{ value: CUSTOM, label: "Otro modelo (escribir su ID)…" },
	];
	const note = current.models.find((m) => m.id === model)?.note;

	return (
		<div className="flex flex-col gap-3">
			<SelectField
				id={`ai-model-${current.id}`}
				label="Modelo"
				value={custom ? CUSTOM : model}
				options={options}
				hint={custom ? undefined : note}
				onChange={(value) => {
					if (value === CUSTOM) {
						setCustom(true);
						return;
					}
					setCustom(false);
					onModelChange(value);
				}}
			/>
			{custom ? (
				<form
					className="flex flex-col gap-1.5"
					onSubmit={(e) => {
						e.preventDefault();
						if (customDraft.trim()) onModelChange(customDraft.trim());
					}}
				>
					<div className="flex items-end gap-3">
						<div className="flex-1">
							<TextField
								id={`ai-custom-model-${current.id}`}
								label="ID del modelo"
								value={customDraft}
								onChange={setCustomDraft}
								placeholder={current.models[0]?.id}
							/>
						</div>
						<Button
							type="submit"
							variant="secondary"
							disabled={!customDraft.trim() || customDraft.trim() === model}
						>
							Usar
						</Button>
					</div>
					<p className="text-xs text-zinc-500">
						{customDraft.trim() === model
							? "En uso."
							: "Tal como lo escribe el proveedor. Pulsa Usar para guardarlo."}
					</p>
				</form>
			) : null}
		</div>
	);
}

function TestRow({ onTest, testing, testResult }: Inner) {
	return (
		<div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-4">
			<Button variant="secondary" onClick={onTest} loading={testing}>
				Probar conexión
			</Button>
			{testResult ? (
				<p
					role="status"
					className={`text-sm ${testResult.ok ? "text-emerald-400" : "text-red-400"}`}
				>
					{testResult.text}
				</p>
			) : (
				<p className="text-xs text-zinc-500">Comprueba que todo está listo sin gastar nada.</p>
			)}
		</div>
	);
}

function Notice({
	tone,
	children,
	onDismiss,
}: {
	tone: "info" | "warning" | "success";
	children: ReactNode;
	onDismiss?: () => void;
}) {
	const colors = {
		warning: "bg-amber-500/10 text-amber-200 ring-amber-400/20",
		info: "bg-sky-500/10 text-sky-200 ring-sky-400/20",
		success: "bg-emerald-500/10 text-emerald-200 ring-emerald-400/20",
	}[tone];
	return (
		<div className={`flex items-start gap-3 rounded-lg px-3 py-2 text-xs ring-1 ${colors}`}>
			<p className="flex-1">{children}</p>
			{onDismiss ? (
				<button type="button" onClick={onDismiss} className="opacity-70 hover:opacity-100">
					Cerrar
				</button>
			) : null}
		</div>
	);
}

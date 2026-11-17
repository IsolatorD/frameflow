import { Button } from "@frameflow/ui/src/atoms/Button/Button";
import { Section } from "@frameflow/ui/src/molecules/Section/Section";
import { UpdateNotice } from "@frameflow/ui/src/molecules/UpdateNotice/UpdateNotice";
import { useUpdates } from "../../../hooks/useUpdates/useUpdates";

const REPO = "https://github.com/IsolatorD/frameflow";

/** Versión, búsqueda de actualizaciones y licencia. */
export function AboutSection() {
	const { state, check, download, install } = useUpdates();
	if (!state) return null;
	const status = state.status;
	const message =
		status === "disabled"
			? "Las actualizaciones se comprueban en la app instalada."
			: status === "checking"
				? "Buscando actualizaciones…"
				: status === "none"
					? "Tienes la última versión."
					: status === "error"
						? state.error
						: null;
	const pending =
		state.version && (status === "available" || status === "downloading" || status === "ready");
	return (
		<Section
			title="Acerca de Frameflow"
			description={`Versión ${state.current}`}
			action={
				status === "disabled" ? null : (
					<Button
						variant="secondary"
						onClick={() => check.mutate()}
						loading={status === "checking" || check.isPending}
					>
						Buscar actualizaciones
					</Button>
				)
			}
		>
			<div className="flex max-w-xl flex-col gap-3">
				{message ? (
					<p
						role="status"
						className={`text-sm ${status === "error" ? "text-red-400" : "text-zinc-400"}`}
					>
						{message}
					</p>
				) : null}
				{pending ? (
					<>
						<UpdateNotice
							version={state.version as string}
							status={status as "available" | "downloading" | "ready"}
							progress={state.progress}
							canInstall={state.canInstall}
							busy={state.busy}
							onDownload={() => download.mutate()}
							onInstall={() => install.mutate()}
						/>
						{!state.canInstall ? (
							<p className="text-xs text-zinc-500">
								En Mac, de momento, la actualización se descarga desde la página de la versión (la
								app aún no está firmada por Apple).
							</p>
						) : null}
						{state.notes ? (
							<div className="whitespace-pre-line rounded-lg bg-white/[0.03] p-3 text-xs text-zinc-300 ring-1 ring-white/10">
								{state.notes}
							</div>
						) : null}
					</>
				) : null}
				{install.error ? <p className="text-sm text-red-400">{install.error.message}</p> : null}
				<p className="text-xs text-zinc-500">
					Software libre bajo licencia GPL-3.0.{" "}
					<a href={REPO} target="_blank" rel="noreferrer" className="underline">
						Código fuente y novedades
					</a>
				</p>
			</div>
		</Section>
	);
}

import { Button } from "../../atoms/Button/Button";
import type { UpdateNoticeProps } from "./UpdateNoticeInterface";

/** Aviso de versión nueva en la barra lateral: descargar, progreso y reiniciar. */
export function UpdateNotice({
	version,
	status,
	progress,
	canInstall,
	busy,
	onDownload,
	onInstall,
	onDetails,
}: UpdateNoticeProps) {
	const percent = Math.round((progress ?? 0) * 100);
	return (
		<section
			aria-label="Actualización disponible"
			className="flex flex-col gap-2 rounded-xl bg-violet-500/10 p-3 ring-1 ring-violet-400/20"
		>
			<p className="text-xs font-medium text-zinc-100">
				{status === "ready" ? `Frameflow ${version} lista` : `Frameflow ${version} disponible`}
			</p>
			{status === "downloading" ? (
				<>
					<div
						role="progressbar"
						aria-label="Descargando la actualización"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={percent}
						className="h-1 overflow-hidden rounded-full bg-white/10"
					>
						<div className="h-full bg-violet-400" style={{ width: `${percent}%` }} />
					</div>
					<p className="text-[11px] text-zinc-400">Descargando… {percent} %</p>
				</>
			) : status === "ready" ? (
				<>
					<Button onClick={onInstall} disabled={busy} className="w-full justify-center">
						Reiniciar y actualizar
					</Button>
					{busy ? (
						<p className="text-[11px] text-zinc-400">Cuando termine el video en curso.</p>
					) : null}
				</>
			) : (
				<Button onClick={onDownload} className="w-full justify-center">
					{canInstall ? "Actualizar" : "Descargar"}
				</Button>
			)}
			{onDetails && status === "available" ? (
				<button
					type="button"
					onClick={onDetails}
					className="self-start text-[11px] text-violet-300 underline-offset-2 hover:underline"
				>
					Ver novedades
				</button>
			) : null}
		</section>
	);
}

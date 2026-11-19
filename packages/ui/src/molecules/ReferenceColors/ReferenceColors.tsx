import { useState } from "react";
import { Button } from "../../atoms/Button/Button";
import type { ReferenceColorsProps, ReferenceColorsResult } from "./ReferenceColorsInterface";

const LABELS = [
	["background", "Fondo"],
	["text", "Texto"],
	["accent", "Acento"],
	["muted", "Secundario"],
] as const;

/** Tomar los colores de la marca de una imagen o un video de referencia. */
export function ReferenceColors({ id, onRead, onUse }: ReferenceColorsProps) {
	const [state, setState] = useState<"idle" | "reading" | "done" | "error">("idle");
	const [result, setResult] = useState<ReferenceColorsResult | null>(null);
	const [error, setError] = useState("");
	const [name, setName] = useState("");
	const inputId = `${id}-file`;

	const read = async (file: File) => {
		setName(file.name);
		setState("reading");
		try {
			setResult(await onRead(file));
			setState("done");
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
			setState("error");
		}
	};

	return (
		<div className="mt-4 rounded-xl bg-white/[0.02] p-4 ring-1 ring-white/10">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className="text-sm font-medium text-zinc-200">Desde una referencia</p>
					<p className="text-xs text-zinc-500">
						Elige una imagen o un video cuyo estilo te guste y Frameflow propone colores parecidos.
						La referencia no sale de tu equipo.
					</p>
				</div>
				<label
					htmlFor={inputId}
					className="cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-violet-300 ring-1 ring-violet-400/40 hover:bg-violet-500/10"
				>
					Elegir imagen o video…
				</label>
				<input
					id={inputId}
					type="file"
					accept="image/*,video/*"
					className="sr-only"
					aria-label="Elegir una imagen o un video de referencia"
					onChange={(e) => {
						const file = e.target.files?.[0];
						e.target.value = "";
						if (file) void read(file);
					}}
				/>
			</div>
			{state === "reading" ? (
				<p className="mt-3 text-sm text-zinc-400" aria-live="polite">
					Leyendo los colores de «{name}»…
				</p>
			) : null}
			{state === "error" ? (
				<p role="alert" className="mt-3 text-sm text-red-400">
					{error}
				</p>
			) : null}
			{state === "done" && result ? (
				<div className="mt-4 flex flex-col gap-3">
					<div>
						<p className="mb-1 text-xs text-zinc-500">Colores de «{name}»</p>
						<div
							className="flex h-4 overflow-hidden rounded-md ring-1 ring-white/10"
							role="img"
							aria-label={`Paleta de la referencia: ${result.swatches.map((s) => s.color).join(", ")}`}
						>
							{result.swatches.map((s) => (
								<span key={s.color} style={{ background: s.color, flexGrow: s.share }} />
							))}
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-4">
						<div
							className="flex h-20 w-36 flex-col justify-center rounded-lg px-3 ring-1 ring-white/10"
							style={{ background: result.theme.background }}
							aria-hidden="true"
						>
							<span className="text-lg font-bold" style={{ color: result.theme.text }}>
								Aa <span style={{ color: result.theme.accent }}>123</span>
							</span>
							<span className="text-xs" style={{ color: result.theme.muted }}>
								texto secundario
							</span>
						</div>
						<ul
							className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-300"
							aria-label="Colores propuestos"
						>
							{LABELS.map(([key, label]) => (
								<li key={key} className="flex items-center gap-2">
									<span
										className="size-3 rounded-sm ring-1 ring-white/20"
										style={{ background: result.theme[key] }}
									/>
									{label} <span className="font-mono text-zinc-500">{result.theme[key]}</span>
								</li>
							))}
						</ul>
					</div>
					<div className="flex gap-2">
						<Button
							onClick={() => {
								onUse(result.theme);
								setState("idle");
								setResult(null);
							}}
						>
							Usar estos colores
						</Button>
						<Button
							variant="ghost"
							onClick={() => {
								setState("idle");
								setResult(null);
							}}
						>
							Descartar
						</Button>
					</div>
				</div>
			) : null}
		</div>
	);
}

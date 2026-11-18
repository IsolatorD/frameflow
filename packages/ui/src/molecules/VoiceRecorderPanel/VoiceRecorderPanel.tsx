import { useId } from "react";
import { Button } from "../../atoms/Button/Button";
import type { VoiceRecorderPanelProps } from "./VoiceRecorderPanelInterface";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Grabar la narración de una escena: texto a leer, nivel del micro, escuchar y usar o repetir. */
export function VoiceRecorderPanel({
	text,
	state,
	level,
	seconds,
	estimate,
	audioUrl,
	error,
	onStart,
	onStop,
	onRetake,
	onUse,
	onImport,
	using = false,
}: VoiceRecorderPanelProps) {
	const fileId = useId();
	const recording = state === "recording";
	return (
		<div className="flex flex-col gap-4">
			<blockquote className="rounded-xl bg-white/[0.03] p-4 text-lg leading-relaxed text-zinc-100 ring-1 ring-white/10">
				{text}
			</blockquote>
			<div className="flex items-center gap-3">
				<span
					aria-hidden="true"
					className={`size-3 rounded-full ${recording ? "animate-pulse bg-red-500" : "bg-zinc-600"}`}
				/>
				<span className="w-12 font-mono text-sm text-zinc-300" aria-live="polite">
					{clock(seconds)}
				</span>
				<meter
					aria-label="Nivel del micrófono"
					min={0}
					max={1}
					value={recording ? level : 0}
					className="sr-only"
				/>
				<div aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
					<div
						className={`h-full transition-[width] duration-75 ${level > 0.85 ? "bg-red-400" : "bg-emerald-400"}`}
						style={{ width: `${Math.round((recording ? level : 0) * 100)}%` }}
					/>
				</div>
				<span className="text-xs text-zinc-500">{estimate}</span>
			</div>
			{audioUrl && state === "recorded" ? (
				// biome-ignore lint/a11y/useMediaCaption: es la voz recién grabada por el propio usuario
				<audio controls src={audioUrl} className="w-full" />
			) : null}
			{error ? (
				<p role="alert" className="text-sm text-red-400">
					{error}
				</p>
			) : null}
			<div className="flex flex-wrap items-center gap-3">
				{state === "recorded" ? (
					<>
						<Button onClick={onUse} loading={using}>
							Usar esta toma
						</Button>
						<Button variant="secondary" onClick={onRetake} disabled={using}>
							Repetir
						</Button>
					</>
				) : recording ? (
					<Button onClick={onStop}>Detener</Button>
				) : (
					<Button onClick={onStart} loading={state === "requesting"}>
						Grabar
					</Button>
				)}
				{!recording && !using ? (
					<label
						htmlFor={fileId}
						className="cursor-pointer text-sm text-violet-300 underline-offset-2 hover:underline"
					>
						O importar un audio…
						<input
							id={fileId}
							type="file"
							accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm"
							className="sr-only"
							onChange={(e) => {
								const file = e.target.files?.[0];
								if (file) onImport(file);
								e.target.value = "";
							}}
						/>
					</label>
				) : null}
			</div>
			<p className="text-xs text-zinc-500">
				Se recortan los silencios del principio y del final y se iguala el volumen. Los subtítulos
				se sincronizan solos con tu voz.
			</p>
		</div>
	);
}

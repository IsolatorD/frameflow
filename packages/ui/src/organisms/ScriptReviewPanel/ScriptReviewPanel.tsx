import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { Section } from "../../molecules/Section/Section";
import type { ScriptReviewPanelProps } from "./ScriptReviewPanelInterface";

/**
 * «Revisar guion con IA»: veredicto, lo que conviene conservar y propuestas concretas
 * (frase → problema → ajuste) que se aplican con un clic.
 */
export function ScriptReviewPanel({
	state,
	verdict,
	keep = [],
	suggestions = [],
	applied = [],
	applying = null,
	error,
	disabledReason,
	hint,
	onReview,
	onCancel,
	onApply,
	onClose,
}: ScriptReviewPanelProps) {
	const action =
		state === "reviewing" ? (
			<Button variant="secondary" onClick={onCancel}>
				Cancelar
			</Button>
		) : state === "done" ? (
			<div className="flex shrink-0 gap-2 whitespace-nowrap">
				<Button variant="ghost" onClick={onReview} disabled={Boolean(disabledReason)}>
					Volver a revisar
				</Button>
				<Button variant="ghost" onClick={onClose}>
					Cerrar
				</Button>
			</div>
		) : (
			<Button variant="secondary" onClick={onReview} disabled={Boolean(disabledReason)}>
				{state === "error" ? "Reintentar" : "Revisar guion"}
			</Button>
		);
	return (
		<Section
			title="Revisar guion con IA"
			description="Un editor exigente lee el guion guardado y propone pocos cambios de alto impacto. No cambia nada hasta que aplicas una propuesta."
			action={action}
		>
			{disabledReason && state !== "reviewing" ? (
				<p className="text-xs text-amber-300/90">{disabledReason}</p>
			) : null}
			{state === "reviewing" ? (
				<p className="flex items-center gap-2 text-sm text-zinc-300" aria-live="polite">
					<span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-violet-400" />
					La IA está leyendo el guion…{hint ? ` ${hint}` : ""}
				</p>
			) : null}
			{state === "error" && error ? (
				<p role="alert" className="text-sm text-red-400">
					{error}
				</p>
			) : null}
			{state === "done" ? (
				<div className="flex flex-col gap-4">
					{verdict ? (
						<blockquote className="rounded-xl bg-violet-500/10 p-4 text-sm leading-relaxed text-zinc-100 ring-1 ring-violet-400/30">
							{verdict}
						</blockquote>
					) : null}
					{keep.length > 0 ? (
						<div>
							<h3 className="mb-1 text-xs font-semibold text-zinc-400">Lo que funciona</h3>
							<ul className="list-inside list-disc text-sm text-zinc-300">
								{keep.map((k) => (
									<li key={k}>{k}</li>
								))}
							</ul>
						</div>
					) : null}
					<ol className="flex flex-col gap-3" aria-label="Propuestas">
						{suggestions.map((s) => {
							const done = applied.includes(s.id);
							return (
								<li key={s.id} className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10">
									<div className="mb-2 flex flex-wrap items-center gap-2">
										<span className="text-sm font-semibold text-zinc-100">{s.where}</span>
										<Badge tone="info">{s.aspect}</Badge>
										{done ? <Badge tone="success">Aplicada</Badge> : null}
									</div>
									{s.quote ? (
										<p className="mb-2 text-sm italic text-zinc-400">«{s.quote}»</p>
									) : null}
									<p className="text-sm text-zinc-300">
										<span className="font-medium text-zinc-200">Problema: </span>
										{s.problem}
									</p>
									<p className="mt-1 text-sm text-zinc-300">
										<span className="font-medium text-zinc-200">Propuesta: </span>
										{s.change}
									</p>
									{s.narration ? (
										<div className="mt-3 rounded-lg bg-black/20 p-3 text-sm text-zinc-200">
											<p>
												<span className="text-xs font-semibold text-zinc-400">
													Nueva narración:{" "}
												</span>
												{s.narration}
											</p>
											{s.lines && s.lines.length > 0 ? (
												<p className="mt-1">
													<span className="text-xs font-semibold text-zinc-400">En pantalla: </span>
													{s.lines.join(" / ")}
												</p>
											) : null}
										</div>
									) : null}
									{s.applicable ? (
										<div className="mt-3">
											<Button
												variant={done ? "ghost" : "primary"}
												onClick={() => onApply(s.id)}
												disabled={done || Boolean(disabledReason) || Boolean(applying)}
												loading={applying === s.id}
												aria-label={`Aplicar la propuesta para ${s.where}`}
											>
												{done ? "Aplicada" : "Aplicar"}
											</Button>
										</div>
									) : null}
								</li>
							);
						})}
					</ol>
				</div>
			) : null}
		</Section>
	);
}

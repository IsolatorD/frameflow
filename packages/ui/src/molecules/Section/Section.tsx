import { useId } from "react";
import type { SectionProps } from "./SectionInterface";

/** Bloque con título del panel (cuentas, videos, marca…). */
export function Section({ title, description, action, children, className = "" }: SectionProps) {
	const titleId = useId();
	return (
		<section
			aria-labelledby={titleId}
			className={`rounded-2xl bg-white/[0.02] p-5 ring-1 ring-white/10 ${className}`}
		>
			<div className="mb-4 flex items-start justify-between gap-4">
				<div>
					<h2 id={titleId} className="text-sm font-semibold text-zinc-100">
						{title}
					</h2>
					{description ? <p className="mt-0.5 text-xs text-zinc-500">{description}</p> : null}
				</div>
				{action}
			</div>
			{children}
		</section>
	);
}

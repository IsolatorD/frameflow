import { useEffect, useId } from "react";
import type { DialogProps } from "./DialogInterface";

export function Dialog({ title, description, onClose, children }: DialogProps) {
	const titleId = useId();

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				className="max-h-full w-full max-w-xl overflow-y-auto rounded-2xl bg-zinc-900 p-6 ring-1 ring-white/10"
			>
				<div className="mb-5 flex items-start justify-between gap-4">
					<div>
						<h2 id={titleId} className="text-lg font-semibold text-zinc-100">
							{title}
						</h2>
						{description ? <p className="mt-1 text-sm text-zinc-400">{description}</p> : null}
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Cerrar"
						className="rounded-md p-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
					>
						✕
					</button>
				</div>
				{children}
			</div>
		</div>
	);
}

import type { KeyboardEvent } from "react";
import type { TabsProps } from "./TabsInterface";

/** Pestañas accesibles (flechas izquierda/derecha para moverse). El panel lo pinta quien las usa. */
export function Tabs({ label, tabs, active, onChange, idPrefix }: TabsProps) {
	const onKey = (event: KeyboardEvent) => {
		const index = tabs.findIndex((t) => t.id === active);
		const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
		if (!delta) return;
		event.preventDefault();
		const next = tabs[(index + delta + tabs.length) % tabs.length];
		if (next) {
			onChange(next.id);
			document.getElementById(`${idPrefix}-tab-${next.id}`)?.focus();
		}
	};

	return (
		<div
			role="tablist"
			aria-label={label}
			onKeyDown={onKey}
			className="flex gap-1 border-b border-white/10"
		>
			{tabs.map((tab) => {
				const selected = tab.id === active;
				return (
					<button
						key={tab.id}
						id={`${idPrefix}-tab-${tab.id}`}
						type="button"
						role="tab"
						aria-selected={selected}
						aria-controls={`${idPrefix}-panel-${tab.id}`}
						tabIndex={selected ? 0 : -1}
						onClick={() => onChange(tab.id)}
						className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
							selected
								? "border-violet-400 text-zinc-100"
								: "border-transparent text-zinc-400 hover:text-zinc-200"
						}`}
					>
						{tab.label}
						{tab.badge ? <span className="ml-1.5 text-violet-300">{tab.badge}</span> : null}
					</button>
				);
			})}
		</div>
	);
}

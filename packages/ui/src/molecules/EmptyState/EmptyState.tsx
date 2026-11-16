import type { EmptyStateProps } from "./EmptyStateInterface";

export function EmptyState({ title, description, action }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 px-6 py-10 text-center">
			<p className="text-sm font-medium text-zinc-200">{title}</p>
			<p className="max-w-sm text-xs text-zinc-500">{description}</p>
			{action ? <div className="mt-2">{action}</div> : null}
		</div>
	);
}

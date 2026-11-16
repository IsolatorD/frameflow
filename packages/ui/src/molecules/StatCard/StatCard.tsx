import type { StatCardProps } from "./StatCardInterface";

export function StatCard({ label, value, hint }: StatCardProps) {
	return (
		<div className="rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/5">
			<p className="text-xs text-zinc-400">{label}</p>
			<p className={`mt-1 text-2xl font-semibold ${value === null ? "text-zinc-600" : ""}`}>
				{value ?? "—"}
			</p>
			{hint ? <p className="mt-0.5 text-xs text-zinc-500">{hint}</p> : null}
		</div>
	);
}

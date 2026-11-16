import type { StepIndicatorProps } from "./StepIndicatorInterface";

const DOT = {
	done: "bg-emerald-500 text-white",
	current: "bg-violet-500 text-white",
	todo: "bg-white/10 text-zinc-400",
} as const;

export function StepIndicator({ steps }: StepIndicatorProps) {
	return (
		<ol className="flex items-center gap-2">
			{steps.map((step, i) => (
				<li
					key={step.id}
					aria-current={step.state === "current" ? "step" : undefined}
					className="flex items-center gap-2"
				>
					{i > 0 ? <span aria-hidden="true" className="h-px w-6 bg-white/15" /> : null}
					<span
						className={`flex size-5 items-center justify-center rounded-full text-[11px] font-semibold ${DOT[step.state]}`}
					>
						{step.state === "done" ? "✓" : i + 1}
					</span>
					<span className={`text-xs ${step.state === "todo" ? "text-zinc-500" : "text-zinc-200"}`}>
						{step.label}
					</span>
				</li>
			))}
		</ol>
	);
}

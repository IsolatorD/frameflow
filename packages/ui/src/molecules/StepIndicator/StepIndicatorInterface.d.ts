export interface Step {
	id: string;
	label: string;
	state: "done" | "current" | "todo";
}

export interface StepIndicatorProps {
	steps: readonly Step[];
}

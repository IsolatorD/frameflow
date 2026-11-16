import type { SelectOption } from "../../atoms/SelectField/SelectFieldInterface";

export interface NewVideoValues {
	topic: string;
	language: string;
	targetSeconds: number;
	mode: "auto" | "stepwise";
}

export interface NewVideoFormProps {
	languages: readonly SelectOption[];
	secondsRange: { min: number; max: number; step: number };
	/** Si el modo automático está disponible y, si no, por qué. */
	ai: { available: boolean; name: string; reason?: string } | null;
	onSubmit: (values: NewVideoValues) => void;
	submitting?: boolean;
	serverError?: string;
}

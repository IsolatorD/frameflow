import type { SelectOption } from "../../atoms/SelectField/SelectFieldInterface";

export interface NewVideoValues {
	topic: string;
	language: string;
	targetSeconds: number;
	mode: "auto" | "stepwise";
	/** Plantilla de estructura del guion. */
	template: string;
}

export interface NewVideoTemplate {
	value: string;
	label: string;
	description: string;
}

export interface NewVideoFormProps {
	languages: readonly SelectOption[];
	secondsRange: { min: number; max: number; step: number };
	/** Estructuras de guion para elegir (la primera es la de por defecto). */
	templates: readonly NewVideoTemplate[];
	/** Si el modo automático está disponible y, si no, por qué. */
	ai: { available: boolean; name: string; reason?: string } | null;
	/** Abre los ajustes de IA (se ofrece cuando la IA no está lista). */
	onOpenAiSettings?: () => void;
	onSubmit: (values: NewVideoValues) => void;
	submitting?: boolean;
	serverError?: string;
}

export interface ScriptReviewSuggestionView {
	id: string;
	/** "Escena 3" o "Todo el video". */
	where: string;
	aspect: string;
	quote: string;
	problem: string;
	change: string;
	/** Narración propuesta, si la propuesta se aplica con un clic. */
	narration?: string;
	/** Texto en pantalla propuesto (escenas de texto). */
	lines?: string[];
	applicable: boolean;
}

export type ScriptReviewState = "idle" | "reviewing" | "done" | "error";

export interface ScriptReviewPanelProps {
	state: ScriptReviewState;
	verdict?: string;
	keep?: readonly string[];
	suggestions?: readonly ScriptReviewSuggestionView[];
	/** Propuestas ya aplicadas. */
	applied?: readonly string[];
	/** Propuesta que se está aplicando ahora. */
	applying?: string | null;
	error?: string;
	/** Por qué no se puede revisar o aplicar ahora (guion sin guardar, IA no lista…). */
	disabledReason?: string;
	/** Cuánto suele tardar, para mostrarlo mientras revisa. */
	hint?: string;
	onReview: () => void;
	onCancel: () => void;
	onApply: (id: string) => void;
	onClose: () => void;
}

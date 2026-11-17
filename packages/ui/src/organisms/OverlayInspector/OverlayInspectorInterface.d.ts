import type { SelectOption } from "../../atoms/SelectField/SelectFieldInterface";
import type { TransitionDraft } from "../../molecules/SceneCard/SceneCardInterface";

export interface OverlayTransformDraft {
	x: number;
	y: number;
	scale: number;
	rotation: number;
	opacity: number;
}

/** Lo editable de una capa (texto, imagen o video). */
export interface OverlayDraft {
	type: "text" | "image" | "video";
	label: string;
	transform: OverlayTransformDraft;
	enter: TransitionDraft;
	exit: TransitionDraft;
	text?: string;
	style?: {
		fontSize: number;
		fontWeight: number;
		color: string;
		background?: string;
		align: "left" | "center" | "right";
	};
	fit?: "cover" | "contain";
	volume?: number;
	trimStart?: number;
	/** Solo lectura: duración del archivo de video. */
	sourceDuration?: number;
}

export interface OverlayInspectorProps {
	/** La capa tal como está guardada. */
	value: OverlayDraft;
	/**
	 * Borrador en curso (controlado desde fuera: también lo edita arrastrar sobre la vista previa);
	 * null = sin cambios.
	 */
	draft: OverlayDraft | null;
	onDraftChange: (draft: OverlayDraft | null) => void;
	onApply: (draft: OverlayDraft) => void;
	onDuplicate: () => void;
	onDelete: () => void;
	/** Colores con nombre del tema del video (text, accent…). */
	colorOptions: readonly SelectOption[];
	applying?: boolean;
	serverError?: string;
	locked?: boolean;
}

import type { SelectOption } from "../../atoms/SelectField/SelectFieldInterface";
import type { TransitionDraft } from "../../molecules/SceneCard/SceneCardInterface";

export interface OverlayTransformDraft {
	x: number;
	y: number;
	scale: number;
	rotation: number;
	opacity: number;
}

export type EasingDraft = "ease" | "ease-in" | "ease-out" | "linear";

export interface OverlayKeyframeDraft {
	/** Segundos desde el inicio de la capa. */
	at: number;
	transform: OverlayTransformDraft;
	easing: EasingDraft;
}

/** Lo editable de una capa (texto, imagen o video). */
export interface OverlayDraft {
	type: "text" | "image" | "video";
	label: string;
	/** Con animación, la transformación en el instante del cabezal. */
	transform: OverlayTransformDraft;
	keyframes?: OverlayKeyframeDraft[];
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

/** Controles de animación (los calcula quien sabe dónde está el cabezal). */
export interface OverlayAnimationProps {
	enabled: boolean;
	/** Segundo del cabezal dentro de la capa. */
	time: number;
	/** ¿El cabezal está dentro de la capa? */
	inside: boolean;
	keyframes: readonly { at: number; current: boolean }[];
	/** El fotograma bajo el cabezal (si hay): su curva de llegada y si es el primero. */
	current: { easing: EasingDraft; first: boolean } | null;
	onEasingChange: (easing: EasingDraft) => void;
	onToggle: (enabled: boolean) => void;
	onAddHere: () => void;
	onRemoveHere: () => void;
	onSeek: (at: number) => void;
}

export interface OverlayInspectorProps {
	animation?: OverlayAnimationProps;
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

export type TimelineClipKind = "scene" | "voice" | "music" | "sfx" | "text" | "media";

export interface TimelineClip {
	id: string;
	start: number;
	duration: number;
	label: string;
	kind: TimelineClipKind;
	/** Algo que atender (p. ej. escena sin voz). */
	warning?: boolean;
	/** Instantes marcados dentro del clip (segundos desde su inicio), p. ej. fotogramas clave. */
	markers?: readonly number[];
	/** Qué se puede hacer con el clip desde la línea de tiempo. */
	editable?: {
		move?: boolean;
		/** Límites de duración al recortar por el borde derecho (segundos). */
		trimEnd?: { min: number; max: number };
	};
}

export interface TimelineTrack {
	id: string;
	label: string;
	clips: readonly TimelineClip[];
}

export interface TimelineProps {
	tracks: readonly TimelineTrack[];
	/** Duración total en segundos. */
	duration: number;
	/** Posición actual en segundos. */
	time: number;
	selectedClipId?: string | null;
	onSeek: (seconds: number) => void;
	onSelectClip: (clipId: string) => void;
	/** Soltar un clip en otro instante (inicio propuesto, en segundos). */
	onMoveClip?: (clipId: string, start: number) => void;
	/** Recortar el borde derecho (duración propuesta, ya dentro de los límites). */
	onTrimClip?: (clipId: string, duration: number) => void;
	/** Bloquea las ediciones (p. ej. mientras se genera la voz). */
	disabled?: boolean;
}

export type TimelineClipKind = "scene" | "voice" | "music" | "text";

export interface TimelineClip {
	id: string;
	start: number;
	duration: number;
	label: string;
	kind: TimelineClipKind;
	/** Algo que atender (p. ej. escena sin voz). */
	warning?: boolean;
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
}

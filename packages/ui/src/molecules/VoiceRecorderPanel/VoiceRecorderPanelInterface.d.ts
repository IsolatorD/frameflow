export type RecorderState = "idle" | "requesting" | "recording" | "recorded" | "error";

export interface VoiceRecorderPanelProps {
	/** Texto que hay que leer (la narración de la escena). */
	text: string;
	state: RecorderState;
	/** Nivel del micrófono, 0–1 (mientras se graba). */
	level: number;
	/** Segundos grabados. */
	seconds: number;
	/** Duración estimada de la narración, para orientarse ("≈ 4,2 s"). */
	estimate: string;
	/** Audio de la toma para escucharla antes de usarla. */
	audioUrl: string | null;
	error?: string;
	onStart: () => void;
	onStop: () => void;
	onRetake: () => void;
	onUse: () => void;
	/** Usar un archivo de audio grabado con otro programa. */
	onImport: (file: File) => void;
	/** La toma se está enviando para procesarla. */
	using?: boolean;
}

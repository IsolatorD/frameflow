export interface CaptionWordDraft {
	/** Lo que dice la voz (no se edita). */
	text: string;
	start: number;
	end: number;
	/** Lo que se ve en pantalla si difiere. */
	display?: string;
}

export interface CaptionScene {
	id: string;
	label: string;
	/** Segundos que dura la voz de la escena (límite de los tiempos). */
	voiceDuration: number;
	words: readonly CaptionWordDraft[];
}

export interface CaptionEditorProps {
	scenes: readonly CaptionScene[];
	onSave: (sceneId: string, words: CaptionWordDraft[]) => void;
	/** Reproduce desde una palabra (segundos relativos al inicio de la voz de la escena). */
	onPlay: (sceneId: string, seconds: number) => void;
	onDirtyChange?: (dirty: boolean) => void;
	saving?: boolean;
	serverError?: string;
	locked?: boolean;
}

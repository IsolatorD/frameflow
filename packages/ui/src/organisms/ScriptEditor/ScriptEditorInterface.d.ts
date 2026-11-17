import type { ScriptSceneDraft } from "../../molecules/SceneCard/SceneCardInterface";

export interface ScriptDraft {
	title: string;
	scenes: ScriptSceneDraft[];
}

export interface ScriptEditorProps {
	value: ScriptDraft;
	onSave: (script: ScriptDraft) => void;
	/** Segundos estimados de narración para un texto. */
	estimateSeconds: (text: string) => number;
	onDirtyChange?: (dirty: boolean) => void;
	saving?: boolean;
	serverError?: string;
	/** Bloquea la edición (p. ej. mientras se genera la voz o el video). */
	locked?: boolean;
	lockedReason?: string;
	defaultTheme: { accent: string; background: string };
	extraTimeRange: { min: number; max: number; step: number };
	/** Ids de escenas con la voz al día; undefined = no mostrar el estado de voz. */
	voicedSceneIds?: readonly string[];
	/** Escena a resaltar y mostrar (p. ej. al pulsarla en la línea de tiempo). */
	focusSceneId?: string | null;
}

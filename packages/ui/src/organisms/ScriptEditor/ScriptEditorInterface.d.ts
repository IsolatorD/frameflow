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
}

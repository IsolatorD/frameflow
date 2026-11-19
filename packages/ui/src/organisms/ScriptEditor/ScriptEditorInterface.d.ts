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
	/** Segundos que hacen falta para leer el contenido en pantalla (sin él, no hay aviso). */
	readingSeconds?: (content: ScriptSceneDraft["content"]) => number;
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
	/** Escenas cuya voz al día es una grabación. */
	recordedSceneIds?: readonly string[];
	/** Grabar la voz de una escena guardada; sin él no se muestra el botón. */
	onRecordScene?: (sceneId: string) => void;
	/** Escena a resaltar y mostrar (p. ej. al pulsarla en la línea de tiempo). */
	focusSceneId?: string | null;
}

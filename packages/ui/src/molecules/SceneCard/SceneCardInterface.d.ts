export interface ScriptLineDraft {
	text: string;
	emphasis?: boolean;
}

export type SceneContentDraft =
	| { type: "kinetic-text"; lines: ScriptLineDraft[] }
	| { type: "stat"; value: number; suffix?: string; label: string };

export interface ScriptSceneDraft {
	narration: string;
	content: SceneContentDraft;
}

export interface SceneCardProps {
	/** Prefijo único para los ids de los campos. */
	id: string;
	index: number;
	total: number;
	scene: ScriptSceneDraft;
	onChange: (scene: ScriptSceneDraft) => void;
	onMove: (delta: -1 | 1) => void;
	onRemove: () => void;
	/** Duración estimada de la narración, ya formateada ("4,2 s"). */
	estimate: string;
	disabled?: boolean;
}

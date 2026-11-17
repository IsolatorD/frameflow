export interface ScriptLineDraft {
	text: string;
	emphasis?: boolean;
}

export type SceneContentDraft =
	| { type: "kinetic-text"; lines: ScriptLineDraft[] }
	| { type: "stat"; value: number; suffix?: string; label: string };

export type TransitionDraft = "none" | "fade" | "slide-up" | "pop";

/** Ajustes visuales de una escena; lo que falta usa el valor por defecto del video. */
export interface SceneSettingsDraft {
	accent?: string;
	background?: string;
	/** Por defecto: sin transición. */
	enter?: TransitionDraft;
	/** Por defecto: fundido. */
	exit?: TransitionDraft;
	extraTime?: number;
}

export interface ScriptSceneDraft {
	/** Identidad estable (la asigna el sistema); las escenas nuevas no la tienen. */
	id?: string;
	narration: string;
	content: SceneContentDraft;
	settings?: SceneSettingsDraft;
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
	/** Colores del video, para empezar a personalizar desde ellos. */
	defaultTheme: { accent: string; background: string };
	extraTimeRange: { min: number; max: number; step: number };
	/** false = la voz de esta escena falta o quedó desactualizada; undefined = no mostrar. */
	voiced?: boolean;
	/** Escena seleccionada desde la línea de tiempo. */
	highlighted?: boolean;
}

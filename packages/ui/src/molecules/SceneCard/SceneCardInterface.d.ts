export interface ScriptLineDraft {
	text: string;
	emphasis?: boolean;
}

export type SceneContentDraft =
	| { type: "kinetic-text"; lines: ScriptLineDraft[] }
	| { type: "stat"; value: number; suffix?: string; label: string }
	| { type: "steps"; title?: string; items: string[] }
	| { type: "timeline"; title?: string; events: { when: string; label: string }[] }
	| { type: "compare"; title?: string; items: { label: string; detail?: string }[] }
	| { type: "chart"; title?: string; suffix?: string; bars: { label: string; value: number }[] };

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
	/** La voz al día de esta escena es una grabación tuya. */
	recorded?: boolean;
	/** Abre la grabación de la voz de esta escena; sin él no se muestra el botón. */
	onRecord?: () => void;
	/** Por qué no se puede grabar ahora (p. ej. hay cambios sin guardar). */
	recordDisabledReason?: string;
	/** Escena seleccionada desde la línea de tiempo. */
	highlighted?: boolean;
}

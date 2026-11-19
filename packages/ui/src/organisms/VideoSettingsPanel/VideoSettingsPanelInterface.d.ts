import type {
	VisualStyleChoice,
	VisualStyleValue,
} from "../../molecules/VisualStylePicker/VisualStylePickerInterface";

export interface MusicDraft {
	src: string;
	label: string;
	volume: number;
	fadeIn: number;
	fadeOut: number;
}

export interface VideoSettingsDraft {
	captions: { enabled: boolean; maxWordsPerPage: number };
	/** Estilo visual de este video (viene del proyecto al crearlo). */
	visualStyle: VisualStyleValue;
	ctaText: string;
	music: MusicDraft | null;
	/** Efectos de sonido sutiles (null = sin efectos). */
	sfx: { volume: number } | null;
}

export interface VideoSettingsPanelProps {
	value: VideoSettingsDraft;
	onSave: (settings: VideoSettingsDraft) => void;
	/** Abre el selector de archivos; devuelve la música elegida o null si se cancela. */
	onPickMusic: () => Promise<MusicDraft | null>;
	/** Estilos visuales disponibles (catálogo). */
	visualStyles: readonly VisualStyleChoice[];
	/** Nombre del estilo del proyecto, para indicarlo ("Holograma · Planeta"). */
	projectStyleLabel?: string;
	wordsPerPageRange: { min: number; max: number };
	volumeRange: { min: number; max: number; step: number };
	/** Volumen inicial de los efectos al activarlos. */
	defaultSfxVolume?: number;
	onDirtyChange?: (dirty: boolean) => void;
	saving?: boolean;
	serverError?: string;
	locked?: boolean;
}

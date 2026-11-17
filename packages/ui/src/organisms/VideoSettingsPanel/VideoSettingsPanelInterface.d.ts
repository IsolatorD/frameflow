export interface MusicDraft {
	src: string;
	label: string;
	volume: number;
	fadeIn: number;
	fadeOut: number;
}

export interface VideoSettingsDraft {
	captions: { enabled: boolean; maxWordsPerPage: number };
	ctaText: string;
	music: MusicDraft | null;
}

export interface VideoSettingsPanelProps {
	value: VideoSettingsDraft;
	onSave: (settings: VideoSettingsDraft) => void;
	/** Abre el selector de archivos; devuelve la música elegida o null si se cancela. */
	onPickMusic: () => Promise<MusicDraft | null>;
	wordsPerPageRange: { min: number; max: number };
	volumeRange: { min: number; max: number; step: number };
	onDirtyChange?: (dirty: boolean) => void;
	saving?: boolean;
	serverError?: string;
	locked?: boolean;
}

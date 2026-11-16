import type { SelectOption } from "../../atoms/SelectField/SelectFieldInterface";
import type { BrandPreviewTheme } from "../../molecules/BrandPreview/BrandPreviewInterface";

export interface BrandVoiceDraft {
	engine: "kokoro" | "recorded";
	voiceId: string;
	speed: number;
}

/** Misma forma que el BrandKit del dominio; la UI no depende del paquete core. */
export interface BrandKitDraft {
	tone: string;
	theme: BrandPreviewTheme;
	fontFamily: string;
	voices: Record<string, BrandVoiceDraft>;
	captions: { enabled: boolean; maxWordsPerPage: number };
	defaultHashtags: string[];
	ctaText: string;
}

export interface BrandKitEditorLanguage {
	code: string;
	label: string;
	voiceOptions: readonly SelectOption[];
}

export interface BrandKitEditorProps {
	value: BrandKitDraft;
	languages: readonly BrandKitEditorLanguage[];
	fontOptions: readonly SelectOption[];
	speedRange: { min: number; max: number; step: number };
	wordsPerPageRange: { min: number; max: number };
	/** Convierte el texto libre de hashtags en la lista final. */
	parseHashtags: (text: string) => string[];
	/** Avisos de legibilidad del tema (no bloquean el guardado). */
	getWarnings?: (theme: BrandPreviewTheme) => string[];
	onSave: (draft: BrandKitDraft) => void;
	/** Avisa cuando hay cambios sin guardar (para proteger la navegación). */
	onDirtyChange?: (dirty: boolean) => void;
	saving?: boolean;
	serverError?: string;
	/** true justo después de guardar con éxito. */
	saved?: boolean;
}

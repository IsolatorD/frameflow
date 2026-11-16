export interface BrandSummaryVoice {
	language: string;
	voiceLabel: string;
	speed: number;
}

export interface BrandSummaryProps {
	theme: { background: string; text: string; accent: string; muted: string };
	tone: string;
	fontFamily: string;
	voices: readonly BrandSummaryVoice[];
	captionsEnabled: boolean;
}

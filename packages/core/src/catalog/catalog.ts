// Catálogos de dominio que la interfaz muestra: voces disponibles y redes sociales.

export type VoiceInfo = {
	id: string;
	name: string;
	gender: "mujer" | "hombre";
	/** Idioma que habla la voz (el prefijo de Kokoro: e = español, a/b = inglés). */
	language: "es" | "en";
	accent?: string;
};

/** Voces de Kokoro disponibles (todas las de español que tiene Kokoro + una selección en inglés). */
export const VOICES: readonly VoiceInfo[] = [
	{ id: "ef_dora", name: "Dora", gender: "mujer", language: "es" },
	{ id: "em_alex", name: "Alex", gender: "hombre", language: "es" },
	{ id: "em_santa", name: "Santa", gender: "hombre", language: "es" },
	{ id: "af_heart", name: "Heart", gender: "mujer", language: "en" },
	{ id: "af_bella", name: "Bella", gender: "mujer", language: "en" },
	{ id: "am_michael", name: "Michael", gender: "hombre", language: "en" },
	{ id: "am_fenrir", name: "Fenrir", gender: "hombre", language: "en" },
	{ id: "bf_emma", name: "Emma", gender: "mujer", language: "en", accent: "británica" },
	{ id: "bm_george", name: "George", gender: "hombre", language: "en", accent: "británico" },
];

export const voicesFor = (language: string): VoiceInfo[] =>
	VOICES.filter((v) => v.language === language);

/** Tipografías de Google Fonts que el motor de video sabe cargar. */
export const FONTS: readonly { family: string; description: string }[] = [
	{ family: "Montserrat", description: "Geométrica y versátil" },
	{ family: "Poppins", description: "Redondeada y amable" },
	{ family: "Inter", description: "Neutra y muy legible" },
	{ family: "Bebas Neue", description: "Condensada, para titulares" },
	{ family: "Oswald", description: "Estrecha y con fuerza" },
	{ family: "Roboto Slab", description: "Con remates, aire editorial" },
];

export const voiceLabel = (voiceId: string): string => {
	const voice = VOICES.find((v) => v.id === voiceId);
	if (!voice) return voiceId;
	return `${voice.name} (${[voice.gender, voice.accent].filter(Boolean).join(", ")})`;
};

export type PlatformId = "youtube" | "instagram" | "facebook" | "tiktok";

export type PlatformInfo = {
	id: PlatformId;
	name: string;
	color: string;
	/** Fase del plan en la que llega la conexión por API (docs/01-vision.md). */
	phase: 2 | 3 | 4;
};

export const PLATFORMS: readonly PlatformInfo[] = [
	{ id: "youtube", name: "YouTube", color: "#FF0033", phase: 2 },
	{ id: "instagram", name: "Instagram", color: "#D62976", phase: 3 },
	{ id: "facebook", name: "Facebook", color: "#1877F2", phase: 3 },
	{ id: "tiktok", name: "TikTok", color: "#25F4EE", phase: 4 },
];

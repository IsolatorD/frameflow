import type { Theme } from "../storyboard/schema";

// Un preset de nicho es la plantilla de partida de un proyecto: look, voz y tono.
// Al crear un proyecto se COPIA en su BrandKit; cambiar el preset después no lo altera.
export type NichePreset = {
	id: string;
	label: string;
	description: string;
	tone: string;
	theme: Theme;
	voices: Record<string, string>; // idioma -> voz de Kokoro
	speed: number;
};

export const BUILT_IN_PRESETS: readonly NichePreset[] = [
	{
		id: "curiosidades",
		label: "Curiosidades",
		description: "Datos sorprendentes y preguntas que enganchan.",
		tone: "Sorprendente y cercano. Arranca con una pregunta o dato impactante. Frases cortas.",
		theme: { background: "#26215C", text: "#FFFFFF", accent: "#FAC775", muted: "#CECBF6" },
		voices: { es: "ef_dora", en: "af_heart" },
		speed: 1.05,
	},
	{
		id: "ciencia",
		label: "Ciencia",
		description: "Divulgación clara con analogías cotidianas.",
		tone: "Claro y riguroso pero divulgativo. Explica causa y efecto con analogías cotidianas.",
		theme: { background: "#04342C", text: "#FFFFFF", accent: "#5DCAA5", muted: "#9FE1CB" },
		voices: { es: "em_alex", en: "am_michael" },
		speed: 1.0,
	},
	{
		id: "historia",
		label: "Historia",
		description: "Relatos con época, lugar y un giro final.",
		tone: "Narrativo, como contar una historia. Sitúa época y lugar, con un giro final.",
		theme: { background: "#412402", text: "#FAEEDA", accent: "#EF9F27", muted: "#FAC775" },
		voices: { es: "em_santa", en: "bm_george" },
		speed: 0.95,
	},
	{
		id: "finanzas",
		label: "Finanzas personales",
		description: "Consejos prácticos y cifras sencillas.",
		tone: "Práctico y directo. Un consejo accionable, cifras sencillas, sin jerga.",
		theme: { background: "#042C53", text: "#FFFFFF", accent: "#85B7EB", muted: "#B5D4F4" },
		voices: { es: "ef_dora", en: "af_heart" },
		speed: 1.0,
	},
];

export const findPreset = (id: string): NichePreset | undefined =>
	BUILT_IN_PRESETS.find((preset) => preset.id === id);

import type { Storyboard } from "../src/storyboard/schema";

// Un preset de nicho fija todo lo que NO debe inventar la IA (look, voz, ritmo)
// y le da instrucciones de tono. La IA solo escribe el contenido.
export type NichePreset = {
	label: string;
	tone: string;
	theme: Storyboard["theme"];
	voices: Record<string, string>; // idioma -> voz de Kokoro
	speed: number;
};

export const PRESETS = {
	curiosidades: {
		label: "Curiosidades",
		tone: "Sorprendente y cercano. Arranca con una pregunta o dato impactante. Frases cortas.",
		theme: { background: "#26215C", text: "#FFFFFF", accent: "#FAC775", muted: "#CECBF6" },
		voices: { es: "ef_dora", en: "af_heart" },
		speed: 1.05,
	},
	ciencia: {
		label: "Ciencia",
		tone: "Claro y riguroso pero divulgativo. Explica causa y efecto con analogías cotidianas.",
		theme: { background: "#04342C", text: "#FFFFFF", accent: "#5DCAA5", muted: "#9FE1CB" },
		voices: { es: "em_alex", en: "am_michael" },
		speed: 1.0,
	},
	historia: {
		label: "Historia",
		tone: "Narrativo, como contar una historia. Sitúa época y lugar, con un giro final.",
		theme: { background: "#412402", text: "#FAEEDA", accent: "#EF9F27", muted: "#FAC775" },
		voices: { es: "em_santa", en: "bm_george" },
		speed: 0.95,
	},
	finanzas: {
		label: "Finanzas personales",
		tone: "Práctico y directo. Un consejo accionable, cifras sencillas, sin jerga.",
		theme: { background: "#042C53", text: "#FFFFFF", accent: "#85B7EB", muted: "#B5D4F4" },
		voices: { es: "ef_dora", en: "af_heart" },
		speed: 1.0,
	},
} satisfies Record<string, NichePreset>;

export type PresetId = keyof typeof PRESETS;

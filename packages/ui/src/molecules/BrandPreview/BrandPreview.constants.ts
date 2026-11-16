/** Frase de ejemplo para los subtítulos de la vista previa. */
export const SAMPLE_NARRATION = "La luz del Sol tarda ocho minutos en llegar".split(" ");

/** La palabra "que suena" en la vista previa. */
export const ACTIVE_WORD_INDEX = 1;

export const SIZES = {
	sm: {
		box: "h-40 w-[90px] gap-2 px-2",
		eyebrow: "text-[10px]",
		value: "text-base",
		label: "text-[9px]",
	},
	lg: {
		box: "h-[400px] w-[225px] gap-3 px-4",
		eyebrow: "text-sm",
		value: "text-5xl",
		label: "text-xs",
	},
} as const;

/** Si la fuente de la marca no está instalada, se usa la del sistema (nunca serif). */
export const fontStack = (family: string) => `"${family}", ui-sans-serif, system-ui, sans-serif`;

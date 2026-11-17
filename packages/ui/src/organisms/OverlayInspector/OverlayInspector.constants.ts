export const ALIGN_OPTIONS = [
	{ value: "left", label: "Izquierda" },
	{ value: "center", label: "Centro" },
	{ value: "right", label: "Derecha" },
] as const;

export const FIT_OPTIONS = [
	{ value: "contain", label: "Ajustar (se ve entera)" },
	{ value: "cover", label: "Rellenar (puede recortarse)" },
] as const;

export const WEIGHT_OPTIONS = [
	{ value: "600", label: "Semi negrita" },
	{ value: "800", label: "Negrita" },
	{ value: "900", label: "Extra negrita" },
] as const;

export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const times = (v: number) => `${v.toFixed(2)}×`;
export const secs = (v: number) => `${v.toFixed(1).replace(".", ",")} s`;

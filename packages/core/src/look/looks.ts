import { z } from "zod";

// Estilos visuales (presets): cómo se dibujan las escenas de un video. El proyecto elige uno por
// defecto y cada video lo hereda al crearse; se puede cambiar o dejar en "Libre" por video.
// Los estilos se añaden de uno en uno con las actualizaciones de la app (docs/08-estilos.md).

/** Estilo elegido: id del catálogo + sus opciones (p. ej. el modelo 3D del holograma). */
export const visualStyleSchema = z.object({
	id: z.string().min(1).default("libre"),
	options: z.record(z.string(), z.string()).default({}),
});
export type VisualStyle = z.infer<typeof visualStyleSchema>;

export const FREE_STYLE: VisualStyle = { id: "libre", options: {} };

export type VisualStyleOption = {
	id: string;
	label: string;
	choices: readonly { id: string; label: string }[];
	default: string;
};

export type VisualStyleInfo = {
	id: string;
	name: string;
	description: string;
	/** Atribución del estilo original (licencia del código portado). */
	credit?: string;
	/** Versión de la app en la que llegó. */
	since: string;
	options: readonly VisualStyleOption[];
};

export const VISUAL_STYLES: readonly VisualStyleInfo[] = [
	{
		id: "libre",
		name: "Libre",
		description:
			"Texto animado y cifras sobre fondo liso, con los colores y la fuente de tu marca.",
		since: "0.1.0",
		options: [],
	},
	{
		id: "hologram",
		name: "Holograma",
		description:
			"Un modelo 3D en wireframe gira sobre un proyector; cada cifra se fija con un recuadro, una línea guía y un número que rueda. Interfaz de ciencia ficción en el tono de tu acento.",
		credit: "Basado en «hologram-hud» de Lemo-Opuscar (Lemomo · LemoLab), licencia MIT.",
		since: "0.2.0",
		options: [
			{
				id: "model",
				label: "Modelo 3D",
				choices: [
					{ id: "planet", label: "Planeta" },
					{ id: "ringed", label: "Planeta con anillos" },
					{ id: "satellite", label: "Satélite" },
					{ id: "rocket", label: "Cohete" },
				],
				default: "planet",
			},
		],
	},
	{
		id: "scale-zoom",
		name: "Viaje de escala",
		description:
			"Cada escena es una parada de un viaje de escala (galaxia, sistema solar, Tierra, célula, virus): Orbi, una pequeña sonda, apunta a la siguiente y la cámara se zambulle en ella. Ilustración plana. Ideal para tips y datos curiosos.",
		credit: "Basado en «flat-space-explainer» de Lemo-Opuscar (Lemomo · LemoLab), licencia MIT.",
		since: "0.3.0",
		options: [
			{
				id: "journey",
				label: "Viaje",
				choices: [
					{ id: "in", label: "Del cosmos a lo diminuto" },
					{ id: "out", label: "De lo diminuto al cosmos" },
				],
				default: "in",
			},
		],
	},
	{
		id: "pictogram",
		name: "Pictogramas",
		description:
			"Diseño gráfico de señalética: una trama de figuras geométricas que se desliza, un gran disco con un pictograma animado (o tu cifra) y titulares en letra muy gruesa. Cada escena con su color y transiciones de rejilla.",
		credit: "Basado en «pictogram-motion» de Lemo-Opuscar (Lemomo · LemoLab), licencia MIT.",
		since: "0.4.0",
		options: [
			{
				id: "color",
				label: "Color",
				choices: [
					{ id: "cycle", label: "Uno distinto en cada escena" },
					{ id: "teal", label: "Verde azulado" },
					{ id: "navy", label: "Azul noche" },
					{ id: "coral", label: "Coral" },
					{ id: "ink", label: "Tinta" },
					{ id: "sky", label: "Celeste" },
					{ id: "yellow", label: "Amarillo" },
				],
				default: "cycle",
			},
		],
	},
];

export const visualStyleInfo = (id: string): VisualStyleInfo | null =>
	VISUAL_STYLES.find((s) => s.id === id) ?? null;

/**
 * Estilo listo para usar: si el id no existe (p. ej. datos de una versión más nueva de la app) se
 * usa "Libre"; las opciones que falten toman su valor por defecto y las desconocidas se ignoran.
 */
export function resolveVisualStyle(style: VisualStyle | undefined | null): VisualStyle {
	const info = style ? visualStyleInfo(style.id) : null;
	if (!info || !style) return FREE_STYLE;
	const options: Record<string, string> = {};
	for (const option of info.options) {
		const value = style.options[option.id];
		options[option.id] = option.choices.some((c) => c.id === value)
			? (value as string)
			: option.default;
	}
	return { id: info.id, options };
}

/** "Holograma · Planeta" para mostrar. */
export function visualStyleLabel(style: VisualStyle): string {
	const resolved = resolveVisualStyle(style);
	const info = visualStyleInfo(resolved.id);
	if (!info) return "Libre";
	const details = info.options
		.map((o) => o.choices.find((c) => c.id === resolved.options[o.id])?.label)
		.filter(Boolean);
	return [info.name, ...details].join(" · ");
}

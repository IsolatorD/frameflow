import { type Script, starterScript } from "./script";

// Plantillas de estructura: formas probadas de contar un video corto. Cada una lleva una guía para
// la IA (modo automático) y un guion inicial para rellenar (modo paso a paso). Si la plantilla
// pide un tipo de escena (p. ej. "pasos"), la IA lo tiene que usar; si no, se le pide una vez.
// Idea: estructuras repetidas en awesome-opus5-5-videos y criterios de la skill «cuestionar-guion».

/** Tipo de escena de la IA (ver ai.ts). */
export type TemplateVisual = "pasos" | "linea" | "comparacion" | "grafico" | "cifra";

export type ScriptTemplate = {
	id: string;
	name: string;
	/** Para el usuario: cuándo usarla. */
	description: string;
	/** Para la IA: la estructura, escena a escena. */
	guide: string;
	/** Tipo de escena que la estructura necesita. */
	requires?: TemplateVisual;
	/** Guion inicial del modo paso a paso. */
	starter: (topic: string) => Script;
};

const mid = (text: string) =>
	/^\p{Lu}\p{Ll}/u.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
const titleOf = (topic: string) => topic.trim().slice(0, 80) || "Nuevo video";
const text = (narration: string, ...lines: string[]) => ({
	narration,
	content: {
		type: "kinetic-text" as const,
		lines: lines.map((t, i) =>
			i === lines.length - 1 ? { text: t, emphasis: true } : { text: t },
		),
	},
});

export const SCRIPT_TEMPLATES: readonly ScriptTemplate[] = [
	{
		id: "libre",
		name: "Libre",
		description: "La IA elige la forma que mejor encaje con el tema.",
		guide: "",
		starter: starterScript,
	},
	{
		id: "dato-curioso",
		name: "Dato curioso",
		description: "Una pregunta, una respuesta sorprendente, el porqué y un cierre que se recuerda.",
		guide: `1. Gancho: una pregunta o una afirmación que sorprenda.
2. La respuesta sorprendente (una "cifra" si hay un número que la haga tangible).
3. El porqué, explicado con una analogía cotidiana (una o dos escenas).
4. Cierre: una frase memorable que conecte con el gancho.`,
		requires: "cifra",
		starter: (topic) => ({
			title: titleOf(topic),
			scenes: [
				text(`¿Te has preguntado ${mid(topic.trim()) || "esto"}?`, "¿Te lo has", "preguntado?"),
				{
					narration: "Escribe la respuesta sorprendente, con los números en letras.",
					content: { type: "stat", value: 0, suffix: "", label: "La respuesta" },
				},
				text("Explica el porqué con una comparación cotidiana.", "El porqué"),
				text("Cierra con una frase que se recuerde.", "Frase final"),
			],
		}),
	},
	{
		id: "paso-a-paso",
		name: "Paso a paso",
		description: "Cómo funciona o cómo se hace algo: el problema, los pasos y el resultado.",
		guide: `1. Gancho: el problema o la pregunta ("¿cómo se forma…?", "¿cómo se hace…?").
2. Una escena "pasos" con los pasos en orden (de 2 a 4).
3. El paso clave, explicado con más detalle.
4. El resultado y un cierre.`,
		requires: "pasos",
		starter: (topic) => ({
			title: titleOf(topic),
			scenes: [
				text(`¿Cómo funciona ${mid(topic.trim()) || "esto"}?`, "¿Cómo funciona?"),
				{
					narration: "Resume aquí los pasos, uno detrás de otro.",
					content: {
						type: "steps",
						title: "Paso a paso",
						items: ["Primer paso", "Segundo paso", "Tercer paso"],
					},
				},
				text("Explica el paso más importante.", "El paso clave"),
				text("Cuenta el resultado y cierra.", "Resultado"),
			],
		}),
	},
	{
		id: "lista",
		name: "Lista",
		description: "«Tres razones…», «cinco cosas…»: se anuncia el número y se repasan.",
		guide: `1. Gancho que anuncie la lista con su número ("tres razones por las que…").
2. Una escena "pasos" que muestre la lista completa (de 2 a 4 elementos).
3. Una escena por elemento, del menos al más sorprendente.
4. Cierre con el elemento más llamativo o una pregunta.`,
		requires: "pasos",
		starter: (topic) => ({
			title: titleOf(topic),
			scenes: [
				text(
					`Tres cosas que no sabías sobre ${mid(topic.trim()) || "esto"}.`,
					"Tres cosas",
					"que no sabías",
				),
				{
					narration: "Presenta las tres de un vistazo.",
					content: { type: "steps", items: ["Primera", "Segunda", "Tercera"] },
				},
				text("Desarrolla la primera.", "Uno"),
				text("Desarrolla la segunda.", "Dos"),
				text("Y la más sorprendente, la tercera.", "Tres"),
			],
		}),
	},
	{
		id: "historia",
		name: "Historia",
		description: "Cómo empezó, los momentos clave y dónde estamos hoy.",
		guide: `1. Gancho: el momento más sorprendente de la historia o una pregunta.
2. Una escena "linea" con los hitos clave en orden (de 2 a 4, con su fecha).
3. El momento clave, contado con detalle.
4. Hoy: qué significa ahora, y cierre.`,
		requires: "linea",
		starter: (topic) => ({
			title: titleOf(topic),
			scenes: [
				text(`La historia de ${mid(topic.trim()) || "esto"} empezó así.`, "Cómo empezó"),
				{
					narration: "Recorre los momentos clave, del primero al último.",
					content: {
						type: "timeline",
						events: [
							{ when: "Año", label: "Primer hito" },
							{ when: "Año", label: "Segundo hito" },
						],
					},
				},
				text("Cuenta el momento clave.", "El momento clave"),
				text("Y hoy, qué significa.", "Hoy"),
			],
		}),
	},
	{
		id: "comparacion",
		name: "Comparación",
		description: "A frente a B: en qué se parecen, en qué no y quién gana.",
		guide: `1. Gancho: la pregunta "¿A o B?" o un mito sobre los dos.
2. Una escena "comparacion" con los dos frente a frente y un detalle de cada uno.
3. El dato decisivo ("cifra" o "grafico" si hay números comparables).
4. Veredicto y cierre.`,
		requires: "comparacion",
		starter: (topic) => ({
			title: titleOf(topic),
			scenes: [
				text(`¿Qué es mejor? ${topic.trim()}`.trim(), "¿A o B?"),
				{
					narration: "Ponlos frente a frente.",
					content: {
						type: "compare",
						items: [
							{ label: "A", detail: "Detalle" },
							{ label: "B", detail: "Detalle" },
						],
					},
				},
				text("Cuenta el dato que decide.", "El dato decisivo"),
				text("Y el veredicto.", "Veredicto"),
			],
		}),
	},
	{
		id: "negocio",
		name: "Negocio o producto",
		description:
			"El problema del cliente, qué haces, cómo funciona en tres pasos, una prueba y tu nombre.",
		guide: `1. El problema de tu cliente, en una frase que se reconozca.
2. Qué haces tú para resolverlo.
3. Una escena "pasos": cómo funciona, en 3 pasos.
4. Una prueba: un resultado concreto ("cifra" si hay un número real).
5. Cierre con el nombre y qué hacer ahora.`,
		requires: "pasos",
		starter: (topic) => ({
			title: titleOf(topic),
			scenes: [
				text("Cuenta el problema de tu cliente en una frase.", "El problema"),
				text(`Así lo resuelve ${mid(topic.trim()) || "tu producto"}.`, "La solución"),
				{
					narration: "Explica cómo funciona en tres pasos.",
					content: {
						type: "steps",
						title: "Cómo funciona",
						items: ["Paso uno", "Paso dos", "Paso tres"],
					},
				},
				{
					narration: "Muestra un resultado real, con el número en letras.",
					content: { type: "stat", value: 0, suffix: "", label: "Resultado real" },
				},
				text("Termina con tu nombre y qué hacer ahora.", "Tu nombre"),
			],
		}),
	},
];

export const DEFAULT_TEMPLATE = "libre";

/** La plantilla con ese id, o la libre si no existe. */
export const scriptTemplate = (id: string | undefined): ScriptTemplate =>
	SCRIPT_TEMPLATES.find((t) => t.id === id) ?? (SCRIPT_TEMPLATES[0] as ScriptTemplate);

import type { SceneContentDraft } from "./SceneCardInterface";

export const MAX_LINES = 3;
/** Elementos de pasos, línea de tiempo y gráfico (la comparación siempre tiene 2). */
export const ITEMS = { min: 2, max: 5 } as const;

export const SCENE_TYPES = [
	{ value: "kinetic-text", label: "Texto animado" },
	{ value: "stat", label: "Cifra destacada" },
	{ value: "steps", label: "Pasos" },
	{ value: "timeline", label: "Línea de tiempo" },
	{ value: "compare", label: "Comparación" },
	{ value: "chart", label: "Gráfico" },
] as const;

/** Fila editable de una escena con elementos: uno o dos textos. */
export type ItemRow = { a: string; b: string };

/** Columnas del editor de elementos de cada tipo. */
export const ITEM_COLUMNS: Record<
	"steps" | "timeline" | "compare" | "chart",
	{ a: string; b?: string; bPlaceholder?: string; numeric?: boolean; item: string }
> = {
	steps: { a: "Paso", item: "paso" },
	timeline: { a: "Cuándo", b: "Qué pasó", item: "hito" },
	compare: { a: "Nombre", b: "Detalle (opcional)", item: "lado" },
	chart: { a: "Etiqueta", b: "Valor", numeric: true, item: "barra" },
};

export const rowsOf = (content: SceneContentDraft): ItemRow[] => {
	switch (content.type) {
		case "steps":
			return content.items.map((a) => ({ a, b: "" }));
		case "timeline":
			return content.events.map((e) => ({ a: e.when, b: e.label }));
		case "compare":
			return content.items.map((c) => ({ a: c.label, b: c.detail ?? "" }));
		case "chart":
			return content.bars.map((bar) => ({
				a: bar.label,
				b: Number.isFinite(bar.value) ? String(bar.value) : "",
			}));
		default:
			return [];
	}
};

/** "1,5" o "1.5" → 1.5; vacío o no numérico → NaN (se avisa antes de guardar). */
export const parseNumber = (text: string) =>
	text.trim() === "" ? Number.NaN : Number(text.trim().replace(",", "."));

export const withRows = (content: SceneContentDraft, rows: ItemRow[]): SceneContentDraft => {
	switch (content.type) {
		case "steps":
			return { ...content, items: rows.map((r) => r.a) };
		case "timeline":
			return { ...content, events: rows.map((r) => ({ when: r.a, label: r.b })) };
		case "compare":
			return {
				...content,
				items: rows.map((r) => ({ label: r.a, ...(r.b ? { detail: r.b } : {}) })),
			};
		case "chart":
			return { ...content, bars: rows.map((r) => ({ label: r.a, value: parseNumber(r.b) })) };
		default:
			return content;
	}
};

/** Textos de la escena (para no perderlos al cambiar de tipo). */
const textsOf = (content: SceneContentDraft): string[] => {
	switch (content.type) {
		case "kinetic-text":
			return content.lines.map((l) => l.text).filter(Boolean);
		case "stat":
			return content.label ? [content.label] : [];
		default:
			return rowsOf(content)
				.map((r) => (content.type === "timeline" ? r.b : r.a))
				.filter(Boolean);
	}
};
const titleOf = (content: SceneContentDraft) =>
	"title" in content ? (content.title ?? "") : content.type === "stat" ? content.label : "";

/** Al cambiar de tipo se conserva lo que se pueda del contenido anterior. */
export const convertContent = (
	content: SceneContentDraft,
	type: SceneContentDraft["type"],
): SceneContentDraft => {
	if (content.type === type) return content;
	const texts = textsOf(content);
	const pick = (n: number) => Array.from({ length: n }, (_, i) => texts[i] ?? "");
	const title = titleOf(content) || undefined;
	switch (type) {
		case "stat":
			return { type: "stat", value: 0, suffix: "", label: texts[0] ?? "" };
		case "steps":
			return { type: "steps", title, items: pick(Math.max(ITEMS.min, Math.min(3, texts.length))) };
		case "timeline":
			return {
				type: "timeline",
				title,
				events: pick(ITEMS.min).map((label) => ({ when: "", label })),
			};
		case "compare":
			return { type: "compare", title, items: pick(2).map((label) => ({ label })) };
		case "chart":
			return {
				type: "chart",
				title,
				suffix: "",
				bars: pick(ITEMS.min).map((label) => ({ label, value: Number.NaN })),
			};
		default:
			return { type: "kinetic-text", lines: [{ text: texts[0] ?? "", emphasis: true }] };
	}
};

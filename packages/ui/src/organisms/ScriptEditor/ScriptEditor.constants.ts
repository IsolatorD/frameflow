import type {
	SceneSettingsDraft,
	ScriptSceneDraft,
} from "../../molecules/SceneCard/SceneCardInterface";
import type { ScriptDraft } from "./ScriptEditorInterface";

export const formatSeconds = (s: number) => `${s.toFixed(1).replace(".", ",")} s`;

export const NEW_SCENE: ScriptSceneDraft = {
	narration: "",
	content: { type: "kinetic-text", lines: [{ text: "", emphasis: true }] },
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Quita lo que coincide con el valor por defecto, para comparar y guardar sin ruido. */
const cleanSettings = (
	settings: SceneSettingsDraft | undefined,
): SceneSettingsDraft | undefined => {
	if (!settings) return undefined;
	const clean: SceneSettingsDraft = {
		...(settings.accent ? { accent: settings.accent.toUpperCase() } : {}),
		...(settings.background ? { background: settings.background.toUpperCase() } : {}),
		...(settings.enter && settings.enter !== "none" ? { enter: settings.enter } : {}),
		...(settings.exit && settings.exit !== "fade" ? { exit: settings.exit } : {}),
		...(settings.extraTime ? { extraTime: settings.extraTime } : {}),
	};
	return Object.keys(clean).length ? clean : undefined;
};

/** Problemas que impiden guardar (mensajes para el usuario, en orden de escena). */
export const scriptProblems = (script: ScriptDraft): string[] => {
	const problems: string[] = [];
	if (!script.title.trim()) problems.push("El video necesita un título.");
	script.scenes.forEach((scene, i) => {
		const n = i + 1;
		if (!scene.narration.trim()) problems.push(`Escena ${n}: falta la narración.`);
		if (scene.content.type === "kinetic-text" && scene.content.lines.some((l) => !l.text.trim()))
			problems.push(`Escena ${n}: hay una línea vacía.`);
		if (scene.content.type === "stat" && !scene.content.label.trim())
			problems.push(`Escena ${n}: falta la explicación de la cifra.`);
		const c = scene.content;
		if (c.type === "steps" && c.items.some((t) => !t.trim()))
			problems.push(`Escena ${n}: hay un paso vacío.`);
		if (c.type === "timeline" && c.events.some((e) => !e.when.trim() || !e.label.trim()))
			problems.push(`Escena ${n}: cada hito necesita cuándo y qué pasó.`);
		if (c.type === "compare" && c.items.some((it) => !it.label.trim()))
			problems.push(`Escena ${n}: falta el nombre de un lado de la comparación.`);
		if (c.type === "chart") {
			if (c.bars.some((b) => !b.label.trim()))
				problems.push(`Escena ${n}: una barra no tiene etiqueta.`);
			if (c.bars.some((b) => !Number.isFinite(b.value) || b.value < 0))
				problems.push(`Escena ${n}: cada barra necesita un valor numérico (0 o más).`);
		}
		for (const color of [scene.settings?.accent, scene.settings?.background]) {
			if (color !== undefined && !HEX.test(color))
				problems.push(`Escena ${n}: un color no es válido (usa #RRGGBB).`);
		}
	});
	return problems;
};

/** Normaliza para comparar y guardar: sin sufijo vacío ni "emphasis: false". */
export const cleanScript = (script: ScriptDraft): ScriptDraft => ({
	title: script.title.trim(),
	scenes: script.scenes.map((scene) => ({
		...(scene.id ? { id: scene.id } : {}),
		...(cleanSettings(scene.settings) ? { settings: cleanSettings(scene.settings) } : {}),
		narration: scene.narration.trim(),
		content: cleanContent(scene.content),
	})),
});

const trimTitle = (title: string | undefined) => (title?.trim() ? { title: title.trim() } : {});

function cleanContent(content: ScriptSceneDraft["content"]): ScriptSceneDraft["content"] {
	switch (content.type) {
		case "stat":
			return {
				type: "stat",
				value: content.value,
				label: content.label.trim(),
				...(content.suffix ? { suffix: content.suffix } : {}),
			};
		case "kinetic-text":
			return {
				type: "kinetic-text",
				lines: content.lines.map((l) => ({
					text: l.text.trim(),
					...(l.emphasis ? { emphasis: true } : {}),
				})),
			};
		case "steps":
			return {
				type: "steps",
				...trimTitle(content.title),
				items: content.items.map((t) => t.trim()),
			};
		case "timeline":
			return {
				type: "timeline",
				...trimTitle(content.title),
				events: content.events.map((e) => ({ when: e.when.trim(), label: e.label.trim() })),
			};
		case "compare":
			return {
				type: "compare",
				...trimTitle(content.title),
				items: content.items.map((it) => ({
					label: it.label.trim(),
					...(it.detail?.trim() ? { detail: it.detail.trim() } : {}),
				})),
			};
		case "chart":
			return {
				type: "chart",
				...trimTitle(content.title),
				...(content.suffix ? { suffix: content.suffix } : {}),
				bars: content.bars.map((b) => ({ label: b.label.trim(), value: b.value })),
			};
	}
}

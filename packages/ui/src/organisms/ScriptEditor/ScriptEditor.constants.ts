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
		content:
			scene.content.type === "stat"
				? {
						type: "stat",
						value: scene.content.value,
						label: scene.content.label.trim(),
						...(scene.content.suffix ? { suffix: scene.content.suffix } : {}),
					}
				: {
						type: "kinetic-text",
						lines: scene.content.lines.map((l) => ({
							text: l.text.trim(),
							...(l.emphasis ? { emphasis: true } : {}),
						})),
					},
	})),
});

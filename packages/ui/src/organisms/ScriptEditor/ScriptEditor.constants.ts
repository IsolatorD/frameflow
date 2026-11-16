import type { ScriptSceneDraft } from "../../molecules/SceneCard/SceneCardInterface";
import type { ScriptDraft } from "./ScriptEditorInterface";

export const formatSeconds = (s: number) => `${s.toFixed(1).replace(".", ",")} s`;

export const NEW_SCENE: ScriptSceneDraft = {
	narration: "",
	content: { type: "kinetic-text", lines: [{ text: "", emphasis: true }] },
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
	});
	return problems;
};

/** Normaliza para comparar y guardar: sin sufijo vacío ni "emphasis: false". */
export const cleanScript = (script: ScriptDraft): ScriptDraft => ({
	title: script.title.trim(),
	scenes: script.scenes.map((scene) => ({
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

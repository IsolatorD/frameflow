import type { SceneContentDraft } from "./SceneCardInterface";

export const MAX_LINES = 3;

export const SCENE_TYPES = [
	{ value: "kinetic-text", label: "Texto animado" },
	{ value: "stat", label: "Cifra destacada" },
] as const;

/** Al cambiar de tipo se conserva lo que se pueda del contenido anterior. */
export const convertContent = (
	content: SceneContentDraft,
	type: SceneContentDraft["type"],
): SceneContentDraft => {
	if (content.type === type) return content;
	if (type === "stat") {
		return {
			type: "stat",
			value: 0,
			suffix: "",
			label: content.type === "kinetic-text" ? (content.lines[0]?.text ?? "") : "",
		};
	}
	return {
		type: "kinetic-text",
		lines: [{ text: content.type === "stat" ? content.label : "", emphasis: true }],
	};
};

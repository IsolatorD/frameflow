import type { CaptionWordDraft } from "./CaptionEditorInterface";

/** Mismas reglas que el núcleo (core/script/edit.ts), para avisar antes de guardar. */
export const captionProblems = (
	words: readonly CaptionWordDraft[],
	voiceDuration: number,
): string[] => {
	const problems: string[] = [];
	let previousStart = 0;
	for (const word of words) {
		if (!Number.isFinite(word.start) || !Number.isFinite(word.end))
			problems.push(`"${word.text}": tiempo no válido.`);
		else if (word.end <= word.start)
			problems.push(`"${word.text}": el final debe ser posterior al inicio.`);
		else if (word.end > voiceDuration + 0.05)
			problems.push(`"${word.text}": termina después de la voz.`);
		else if (word.start < previousStart)
			problems.push(`"${word.text}": empieza antes que la palabra anterior.`);
		previousStart = word.start;
	}
	return problems;
};

export const toSeconds = (value: string) =>
	value.trim() === "" ? Number.NaN : Number(value.replace(",", "."));

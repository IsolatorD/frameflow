import type { Script } from "@frameflow/core/script";
import {
	applySuggestion,
	canApply,
	REVIEW_ASPECT_LABELS,
	type ScriptReview,
} from "@frameflow/core/script/review";
import { ScriptReviewPanel } from "@frameflow/ui/src/organisms/ScriptReviewPanel/ScriptReviewPanel";
import type { ScriptReviewSuggestionView } from "@frameflow/ui/src/organisms/ScriptReviewPanel/ScriptReviewPanelInterface";
import { useMemo, useState } from "react";
import { useAiStatus } from "../../../hooks/useAiStatus/useAiStatus";
import type { useVideoActions } from "../../../hooks/useVideoActions/useVideoActions";

const CANCELLED = "Revisión cancelada";

/** «Revisar guion con IA» sobre el guion guardado; cada propuesta se aplica como una edición más. */
export function ScriptReviewSection({
	script,
	actions,
	dirty,
	busy,
}: {
	script: Script;
	actions: ReturnType<typeof useVideoActions>;
	dirty: boolean;
	busy: boolean;
}) {
	const ai = useAiStatus();
	const [review, setReview] = useState<ScriptReview | null>(null);
	const [applied, setApplied] = useState<string[]>([]);
	const [applying, setApplying] = useState<string | null>(null);
	const local = ai.data?.available && /ollama|local|qwen/i.test(ai.data.name);

	const disabledReason = busy
		? "Espera a que termine la tarea en marcha."
		: dirty
			? "Guarda el guion antes de revisarlo: la IA lee el texto guardado."
			: ai.data && !ai.data.available
				? ai.data.reason
				: undefined;

	const suggestions = useMemo<ScriptReviewSuggestionView[]>(
		() =>
			(review?.suggestions ?? []).map((s, i) => ({
				id: String(i),
				where: s.scene === null ? "Todo el video" : `Escena ${s.scene + 1}`,
				aspect: REVIEW_ASPECT_LABELS[s.aspect],
				quote: s.quote,
				problem: s.problem,
				change: s.change,
				narration: s.narration,
				lines: s.lines?.map((l) => l.text),
				applicable: canApply(s),
			})),
		[review],
	);

	const error = actions.reviewScript.error?.message;
	const state = actions.reviewScript.isPending
		? "reviewing"
		: error && error !== CANCELLED
			? "error"
			: review
				? "done"
				: "idle";

	return (
		<ScriptReviewPanel
			state={state}
			verdict={review?.verdict}
			keep={review?.keep}
			suggestions={suggestions}
			applied={applied}
			applying={applying}
			error={error}
			disabledReason={disabledReason}
			hint={local ? "Con el modelo local tarda de 2 a 5 minutos." : undefined}
			onReview={() =>
				actions.reviewScript.mutate(undefined, {
					onSuccess: (result) => {
						setReview(result);
						setApplied([]);
					},
				})
			}
			onCancel={() => actions.cancelReview.mutate()}
			onApply={(id) => {
				const s = review?.suggestions[Number(id)];
				if (!s) return;
				setApplying(id);
				actions.saveScript.mutate(applySuggestion(script, s), {
					onSuccess: () => setApplied((list) => [...list, id]),
					onSettled: () => setApplying(null),
				});
			}}
			onClose={() => {
				setReview(null);
				setApplied([]);
				actions.reviewScript.reset();
			}}
		/>
	);
}

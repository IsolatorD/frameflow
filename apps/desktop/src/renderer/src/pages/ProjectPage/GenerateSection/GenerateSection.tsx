import type { ProjectWithBrand, SUPPORTED_LANGUAGES } from "@frameflow/core/project";
import { TARGET_SECONDS_RANGE } from "@frameflow/core/script";
import { NewVideoForm } from "@frameflow/ui/src/organisms/NewVideoForm/NewVideoForm";
import { useNavigate } from "react-router";
import { useAiStatus } from "../../../hooks/useAiStatus/useAiStatus";
import { useCreateVideo } from "../../../hooks/useVideoActions/useVideoActions";
import { videoPath } from "../../../utils/router/router";

const LANGUAGE_NAMES: Record<(typeof SUPPORTED_LANGUAGES)[number], string> = {
	es: "Español",
	en: "Inglés",
};

/** Sección "Generar video": el formulario del primer paso. Al crear, abre el video. */
export function GenerateSection({ project }: { project: ProjectWithBrand }) {
	const navigate = useNavigate();
	const ai = useAiStatus();
	const create = useCreateVideo();

	return (
		<NewVideoForm
			languages={project.languages.map((code) => ({ value: code, label: LANGUAGE_NAMES[code] }))}
			secondsRange={TARGET_SECONDS_RANGE}
			ai={
				ai.data
					? ai.data.available
						? { available: true, name: ai.data.name }
						: { available: false, name: ai.data.name, reason: ai.data.reason }
					: ai.error
						? { available: false, name: "IA", reason: ai.error.message }
						: null
			}
			submitting={create.isPending}
			serverError={create.error?.message}
			onSubmit={(values) =>
				create.mutate(
					{ projectId: project.id, format: project.defaultFormat, ...values },
					{ onSuccess: (video) => navigate(videoPath(project.id, video.id)) },
				)
			}
		/>
	);
}

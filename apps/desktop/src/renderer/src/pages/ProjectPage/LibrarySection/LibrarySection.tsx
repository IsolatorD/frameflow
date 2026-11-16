import { Button } from "@frameflow/ui/src/atoms/Button/Button";
import { EmptyState } from "@frameflow/ui/src/molecules/EmptyState/EmptyState";
import { VideoList } from "@frameflow/ui/src/organisms/VideoList/VideoList";
import { useNavigate } from "react-router";
import { useVideos } from "../../../hooks/useVideos/useVideos";
import { projectPath, videoPath } from "../../../utils/router/router";
import { toVideoListItem } from "../../../utils/videoStatus/videoStatus";

/** Videos del canal (todos, o los `limit` más recientes en el panel). */
export function LibrarySection({ projectId, limit }: { projectId: string; limit?: number }) {
	const navigate = useNavigate();
	const videos = useVideos(projectId);

	if (videos.isPending) return <p className="text-sm text-zinc-500">Cargando…</p>;
	if (videos.error) {
		return (
			<p role="alert" className="text-sm text-red-400">
				No se pudieron cargar los videos: {videos.error.message}
			</p>
		);
	}
	if (videos.data.length === 0) {
		return (
			<EmptyState
				title="Todavía no hay videos"
				description="Genera el primer video del canal: un tema basta para empezar."
				action={
					<Button variant="secondary" onClick={() => navigate(projectPath(projectId, "generate"))}>
						Generar el primero
					</Button>
				}
			/>
		);
	}
	return (
		<VideoList
			items={videos.data.slice(0, limit).map(toVideoListItem)}
			onOpen={(id) => navigate(videoPath(projectId, id))}
		/>
	);
}

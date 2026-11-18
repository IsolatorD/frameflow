import { Dialog } from "@frameflow/ui/src/molecules/Dialog/Dialog";
import { VoiceRecorderPanel } from "@frameflow/ui/src/molecules/VoiceRecorderPanel/VoiceRecorderPanel";
import { useVoiceRecorder } from "../../../hooks/useVoiceRecorder/useVoiceRecorder";

/** Grabar (o importar) la voz de una escena y enviarla a procesar. */
export function RecordVoiceDialog({
	index,
	narration,
	estimate,
	onUse,
	onClose,
	using,
	error,
}: {
	index: number;
	narration: string;
	estimate: string;
	onUse: (take: { pcm: Float32Array; sampleRate: number }) => void;
	onClose: () => void;
	using: boolean;
	error?: string;
}) {
	const recorder = useVoiceRecorder();
	return (
		<Dialog
			title={`Grabar la voz de la escena ${index + 1}`}
			description="Lee el texto con calma. Puedes escuchar la toma y repetirla antes de usarla."
			onClose={() => {
				recorder.reset();
				onClose();
			}}
		>
			<VoiceRecorderPanel
				text={narration}
				state={recorder.state}
				level={recorder.level}
				seconds={recorder.seconds}
				estimate={`≈ ${estimate}`}
				audioUrl={recorder.audioUrl}
				error={recorder.error ?? error}
				onStart={() => void recorder.start()}
				onStop={recorder.stop}
				onRetake={recorder.reset}
				onUse={() => {
					if (recorder.take) onUse(recorder.take);
				}}
				onImport={recorder.importFile}
				using={using}
			/>
		</Dialog>
	);
}

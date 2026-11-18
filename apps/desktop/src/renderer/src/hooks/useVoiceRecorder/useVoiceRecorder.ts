import { useCallback, useEffect, useRef, useState } from "react";

// Grabar con el micrófono (MediaRecorder) o importar un archivo, y decodificar la toma a audio mono
// en Float32 (Web Audio) para enviarla al proceso principal, que la limpia y sincroniza.

export type RecorderState = "idle" | "requesting" | "recording" | "recorded" | "error";
export type Take = { pcm: Float32Array; sampleRate: number };

async function decode(blob: Blob): Promise<Take> {
	const context = new AudioContext();
	try {
		const buffer = await context.decodeAudioData(await blob.arrayBuffer());
		// Mezcla a mono.
		const pcm = new Float32Array(buffer.length);
		for (let c = 0; c < buffer.numberOfChannels; c++) {
			const data = buffer.getChannelData(c);
			for (let i = 0; i < data.length; i++)
				pcm[i] = (pcm[i] as number) + (data[i] as number) / buffer.numberOfChannels;
		}
		return { pcm, sampleRate: buffer.sampleRate };
	} finally {
		void context.close();
	}
}

const micError = (error: unknown) => {
	const name = error instanceof DOMException ? error.name : "";
	if (name === "NotAllowedError")
		return "Frameflow no tiene permiso para usar el micrófono. Actívalo en los ajustes del sistema (Privacidad → Micrófono).";
	if (name === "NotFoundError") return "No se encontró ningún micrófono.";
	return `No se pudo grabar: ${error instanceof Error ? error.message : String(error)}`;
};

export function useVoiceRecorder() {
	const [state, setState] = useState<RecorderState>("idle");
	const [level, setLevel] = useState(0);
	const [seconds, setSeconds] = useState(0);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [take, setTake] = useState<Take | null>(null);
	const [error, setError] = useState<string>();
	const cleanup = useRef<() => void>(() => {});

	const reset = useCallback(() => {
		cleanup.current();
		setState("idle");
		setLevel(0);
		setSeconds(0);
		setTake(null);
		setError(undefined);
		setAudioUrl((url) => {
			if (url) URL.revokeObjectURL(url);
			return null;
		});
	}, []);

	useEffect(() => () => cleanup.current(), []);

	const acceptBlob = useCallback(async (blob: Blob, elapsed?: number) => {
		try {
			const decoded = await decode(blob);
			setTake(decoded);
			setSeconds(elapsed ?? decoded.pcm.length / decoded.sampleRate);
			setAudioUrl(URL.createObjectURL(blob));
			setState("recorded");
		} catch {
			setError("No se pudo leer el audio. Prueba con WAV, MP3 o M4A.");
			setState("error");
		}
	}, []);

	const start = useCallback(async () => {
		reset();
		setState("requesting");
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
			});
			const context = new AudioContext();
			const analyser = context.createAnalyser();
			analyser.fftSize = 1024;
			context.createMediaStreamSource(stream).connect(analyser);
			const samples = new Float32Array(analyser.fftSize);
			const recorder = new MediaRecorder(stream);
			const chunks: Blob[] = [];
			const started = performance.now();
			let frame = 0;
			const tick = () => {
				analyser.getFloatTimeDomainData(samples);
				let sum = 0;
				for (const v of samples) sum += v * v;
				setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4));
				setSeconds((performance.now() - started) / 1000);
				frame = requestAnimationFrame(tick);
			};
			cleanup.current = () => {
				cancelAnimationFrame(frame);
				if (recorder.state !== "inactive") recorder.stop();
				for (const track of stream.getTracks()) track.stop();
				void context.close();
				cleanup.current = () => {};
			};
			recorder.ondataavailable = (e) => chunks.push(e.data);
			recorder.onstop = () => {
				const elapsed = (performance.now() - started) / 1000;
				cleanup.current();
				void acceptBlob(new Blob(chunks, { type: recorder.mimeType }), elapsed);
			};
			recorder.start();
			tick();
			setState("recording");
		} catch (e) {
			cleanup.current();
			setError(micError(e));
			setState("error");
		}
	}, [reset, acceptBlob]);

	return {
		state,
		level,
		seconds,
		audioUrl,
		take,
		error,
		start,
		/** Detiene la grabación (la toma queda lista para escucharla). */
		stop: useCallback(() => {
			// onstop decodifica la toma; aquí solo se pide parar.
			const stopNow = cleanup.current;
			stopNow();
		}, []),
		reset,
		importFile: useCallback(
			(file: File) => {
				reset();
				void acceptBlob(file);
			},
			[reset, acceptBlob],
		),
	};
}

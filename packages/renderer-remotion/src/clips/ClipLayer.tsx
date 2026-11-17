import type { Transform, Transition } from "@frameflow/core/storyboard";
import type { ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Progreso 0→1 de una transición; 1 si no hay transición. */
const progress = (frame: number, transition: Transition | undefined, fps: number) =>
	!transition || transition.type === "none"
		? 1
		: interpolate(frame, [0, transition.duration * fps], [0, 1], clamp);

/** Efecto visual de una transición con progreso p (0 = invisible, 1 = en su sitio). */
const effect = (transition: Transition | undefined, p: number) => {
	switch (transition?.type) {
		case "fade":
			return { opacity: p, translateY: 0, scale: 1 };
		case "slide-up":
			return { opacity: p, translateY: (1 - Easing.out(Easing.cubic)(p)) * 120, scale: 1 };
		case "pop":
			return {
				opacity: Math.min(1, p * 2),
				translateY: 0,
				scale: 0.6 + 0.4 * Easing.out(Easing.back(2))(p),
			};
		default:
			return { opacity: 1, translateY: 0, scale: 1 };
	}
};

/**
 * Capa de un clip visual: posición/escala/rotación/opacidad + transiciones de entrada y salida.
 * Se usa dentro de un <Sequence>, así que el fotograma es relativo al inicio del clip.
 */
export const ClipLayer = ({
	clipId,
	transform,
	enter,
	exit,
	children,
}: {
	/** Marca el clip en el DOM (data-clip-id): el editor mide su caja para arrastrarlo. */
	clipId?: string;
	transform?: Transform;
	enter?: Transition;
	exit?: Transition;
	children: ReactNode;
}) => {
	const frame = useCurrentFrame();
	const { fps, width, height, durationInFrames } = useVideoConfig();
	const t = transform ?? { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1 };
	const inFx = effect(enter, progress(frame, enter, fps));
	const outFx = effect(exit, progress(durationInFrames - frame, exit, fps));

	return (
		<AbsoluteFill
			data-clip-id={clipId}
			style={{
				opacity: t.opacity * inFx.opacity * outFx.opacity,
				transform: [
					`translate(${(t.x - 0.5) * width}px, ${(t.y - 0.5) * height + inFx.translateY - outFx.translateY}px)`,
					`scale(${t.scale * inFx.scale * outFx.scale})`,
					`rotate(${t.rotation}deg)`,
				].join(" "),
			}}
		>
			{children}
		</AbsoluteFill>
	);
};

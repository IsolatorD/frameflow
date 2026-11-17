import type { TransitionDraft } from "../SceneCard/SceneCardInterface";

export const TRANSITION_OPTIONS: readonly { value: TransitionDraft; label: string }[] = [
	{ value: "none", label: "Ninguna" },
	{ value: "fade", label: "Fundido" },
	{ value: "slide-up", label: "Deslizar hacia arriba" },
	{ value: "pop", label: "Aparecer con rebote" },
];

export const formatPause = (s: number) =>
	s === 0 ? "Sin pausa" : `${s.toFixed(1).replace(".", ",")} s`;

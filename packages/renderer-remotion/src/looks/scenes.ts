import type { Storyboard } from "@frameflow/core/storyboard";

// Escenas del storyboard tal como las ven los escenarios de los estilos: en orden y con su
// contenido (texto animado o cifra).

export type Scene = {
	start: number;
	end: number;
	content:
		| { type: "kinetic-text"; lines: { text: string; emphasis?: boolean }[] }
		| { type: "stat"; value: number; label: string; suffix?: string };
};

export const scenesOf = (storyboard: Storyboard): Scene[] =>
	storyboard.tracks
		.filter((t) => t.kind === "visual" && !t.hidden)
		.flatMap((t) => t.clips as readonly { type: string }[])
		.filter(
			(c): c is { type: "scene"; start: number; duration: number; content: Scene["content"] } =>
				c.type === "scene",
		)
		.map((c) => ({ start: c.start, end: c.start + c.duration, content: c.content }))
		.sort((a, b) => a.start - b.start);

export const formatValue = (value: number, language: string) =>
	value.toLocaleString(language === "en" ? "en-US" : "es-ES", { maximumFractionDigits: 2 });

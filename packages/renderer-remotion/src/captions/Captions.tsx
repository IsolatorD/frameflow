import type { Theme } from "@frameflow/core/storyboard";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type Word = { text: string; start: number; end: number };

// Agrupa palabras en "páginas" cortas; corta antes si una palabra termina en puntuación.
export const toPages = (words: Word[], maxWords: number): Word[][] => {
	const pages: Word[][] = [];
	let current: Word[] = [];
	for (const word of words) {
		current.push(word);
		if (current.length >= maxWords || /[.,;:!?…]$/.test(word.text)) {
			pages.push(current);
			current = [];
		}
	}
	if (current.length > 0) pages.push(current);
	return pages;
};

// Subtítulos estilo TikTok: una página a la vez, la palabra que suena resaltada.
export const Captions = ({
	words,
	maxWordsPerPage,
	theme,
}: {
	words: Word[];
	maxWordsPerPage: number;
	theme: Theme;
}) => {
	const frame = useCurrentFrame();
	const { fps, height } = useVideoConfig();
	const t = frame / fps;

	const pages = toPages(words, maxWordsPerPage);
	// Página visible: la última que ya empezó (se mantiene hasta que empiece la siguiente).
	const pageIndex = pages.findLastIndex((p) => (p[0]?.start ?? Number.POSITIVE_INFINITY) <= t);
	const page = pages[pageIndex];
	const firstWord = page?.[0];
	if (!page || !firstWord) return null;
	const pageStartFrame = Math.round(firstWord.start * fps);
	const pop = spring({ frame: frame - pageStartFrame, fps, config: { damping: 14 } });

	return (
		<AbsoluteFill
			style={{
				justifyContent: "flex-end",
				alignItems: "center",
				paddingBottom: height * 0.12,
			}}
		>
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					justifyContent: "center",
					gap: "4px 6px",
					maxWidth: "88%",
					padding: "18px 32px",
					borderRadius: 24,
					backgroundColor: "rgba(0, 0, 0, 0.45)",
					transform: `scale(${0.85 + pop * 0.15})`,
					opacity: pop,
				}}
			>
				{page.map((word, i) => {
					const active = t >= word.start && t < word.end;
					return (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: las palabras de una página son fijas; la posición es su identidad
							key={`${pageIndex}-${i}`}
							style={{
								fontSize: 64,
								fontWeight: 800,
								// Todas las palabras llevan el mismo padding: resaltar no mueve el layout.
								padding: "2px 12px",
								borderRadius: 14,
								color: active ? theme.background : theme.text,
								backgroundColor: active ? theme.accent : "transparent",
							}}
						>
							{word.text}
						</span>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};

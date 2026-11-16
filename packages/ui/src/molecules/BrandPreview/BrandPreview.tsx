import { ACTIVE_WORD_INDEX, fontStack, SAMPLE_NARRATION, SIZES } from "./BrandPreview.constants";
import type { BrandPreviewProps } from "./BrandPreviewInterface";

/** Fotograma 9:16 de ejemplo con los colores y la tipografía del canal. */
export function BrandPreview({
	theme,
	fontFamily,
	size = "sm",
	captions,
	ctaText,
}: BrandPreviewProps) {
	const s = SIZES[size];
	const words = captions?.enabled ? SAMPLE_NARRATION.slice(0, captions.maxWordsPerPage) : [];

	return (
		<div
			aria-hidden="true"
			className={`relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg ${s.box}`}
			style={{ backgroundColor: theme.background, fontFamily: fontStack(fontFamily) }}
		>
			<span className={`font-semibold ${s.eyebrow}`} style={{ color: theme.text }}>
				¿Sabías que
			</span>
			<span className={`font-extrabold leading-none ${s.value}`} style={{ color: theme.accent }}>
				8 min
			</span>
			<span className={`text-center ${s.label}`} style={{ color: theme.muted }}>
				tarda la luz en llegar
			</span>

			{size === "lg" && words.length > 0 ? (
				<div
					data-testid="preview-captions"
					className="absolute inset-x-3 bottom-16 flex flex-wrap justify-center gap-x-0.5 gap-y-1 rounded-xl bg-black/45 px-2 py-1.5"
				>
					{words.map((word, i) => (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: frase fija de ejemplo; la posición es su identidad
							key={i}
							className="rounded-md px-1 text-sm font-extrabold"
							style={
								i === ACTIVE_WORD_INDEX
									? { color: theme.background, backgroundColor: theme.accent }
									: { color: theme.text }
							}
						>
							{word}
						</span>
					))}
				</div>
			) : null}

			{size === "lg" && ctaText ? (
				<span
					className="absolute inset-x-3 bottom-4 truncate rounded-full px-3 py-1 text-center text-xs font-bold"
					style={{ color: theme.background, backgroundColor: theme.accent }}
				>
					{ctaText}
				</span>
			) : null}
		</div>
	);
}

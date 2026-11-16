import { BrandPreview } from "../../molecules/BrandPreview/BrandPreview";
import { THEME_LABELS } from "./BrandSummary.constants";
import type { BrandSummaryProps } from "./BrandSummaryInterface";

/** Resumen de la identidad del canal: paleta, mini vista previa, voces y tono. */
export function BrandSummary({
	theme,
	tone,
	fontFamily,
	voices,
	captionsEnabled,
}: BrandSummaryProps) {
	return (
		<div className="flex gap-5">
			<BrandPreview theme={theme} fontFamily={fontFamily} />
			<dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
				<dt className="text-zinc-500">Colores</dt>
				<dd className="flex flex-wrap gap-1.5">
					{(Object.keys(THEME_LABELS) as (keyof typeof THEME_LABELS)[]).map((key) => (
						<span
							key={key}
							title={`${THEME_LABELS[key]}: ${theme[key]}`}
							className="size-5 rounded-md ring-1 ring-white/15"
							style={{ backgroundColor: theme[key] }}
						/>
					))}
				</dd>
				<dt className="text-zinc-500">Voces</dt>
				<dd className="flex flex-col gap-0.5 text-zinc-200">
					{voices.map((voice) => (
						<span key={voice.language}>
							<span className="text-zinc-500">{voice.language.toUpperCase()}</span> ·{" "}
							{voice.voiceLabel}
							{voice.speed !== 1 ? (
								<span className="text-zinc-500"> · {voice.speed.toFixed(2)}×</span>
							) : null}
						</span>
					))}
				</dd>
				<dt className="text-zinc-500">Subtítulos</dt>
				<dd className="text-zinc-200">{captionsEnabled ? "Activados" : "Desactivados"}</dd>
				<dt className="text-zinc-500">Tono</dt>
				<dd className="line-clamp-3 text-zinc-300">{tone}</dd>
			</dl>
		</div>
	);
}

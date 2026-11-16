import { PLATFORMS, voiceLabel } from "@frameflow/core/catalog";
import type { ProjectWithBrand } from "@frameflow/core/project";
import type { PlatformTileProps } from "@frameflow/ui/src/molecules/PlatformTile/PlatformTileInterface";
import type { BrandSummaryProps } from "@frameflow/ui/src/organisms/BrandSummary/BrandSummaryInterface";

export type SectionId =
	| "overview"
	| "generate"
	| "library"
	| "calendar"
	| "stats"
	| "brand"
	| "accounts";

export type SectionInfo = {
	id: SectionId;
	label: string;
	/** Qué hará la sección cuando esté lista (se muestra mientras tanto). */
	upcoming?: string;
};

export const SECTIONS: readonly SectionInfo[] = [
	{ id: "overview", label: "Panel" },
	{
		id: "generate",
		label: "Generar video",
		upcoming:
			"Escribe un tema (o elige uno del banco de ideas) y Frameflow crea el guion, la voz, los subtítulos y el video con la marca del canal.",
	},
	{
		id: "library",
		label: "Biblioteca",
		upcoming:
			"Todos los videos del canal con sus versiones por idioma y formato, listos para editar o exportar.",
	},
	{
		id: "calendar",
		label: "Calendario",
		upcoming: "Planifica y programa las publicaciones del canal en cada red.",
	},
	{
		id: "stats",
		label: "Estadísticas",
		upcoming: "Vistas, retención y seguidores por video y por red, cuando conectes las cuentas.",
	},
	{ id: "brand", label: "Marca y estilo" },
	{
		id: "accounts",
		label: "Cuentas",
		upcoming:
			"Conecta YouTube, Instagram, Facebook y TikTok para publicar y medir desde Frameflow.",
	},
];

export const findSection = (id: string | undefined): SectionInfo =>
	SECTIONS.find((s) => s.id === id) ?? (SECTIONS[0] as SectionInfo);

/** Aún no hay cuentas conectadas: cada red muestra en qué fase llega su conexión. */
export const platformTiles = (): (PlatformTileProps & { id: string })[] =>
	PLATFORMS.map((platform) => ({
		id: platform.id,
		name: platform.name,
		color: platform.color,
		status: "disconnected",
		detail: `Conexión en la fase ${platform.phase}`,
	}));

export const brandSummaryProps = (project: ProjectWithBrand): BrandSummaryProps => ({
	theme: project.brandKit.theme,
	tone: project.brandKit.tone,
	fontFamily: project.brandKit.fontFamily,
	captionsEnabled: project.brandKit.captions.enabled,
	voices: project.languages.flatMap((language) => {
		const voice = project.brandKit.voices[language];
		return voice ? [{ language, voiceLabel: voiceLabel(voice.voiceId), speed: voice.speed }] : [];
	}),
});

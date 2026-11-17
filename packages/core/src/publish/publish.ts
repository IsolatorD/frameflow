import { z } from "zod";
import type { PlatformId } from "../catalog/catalog";

// Exportar para redes (fase 1, sin cuentas conectadas): el texto de cada red, sus límites y las
// comprobaciones antes de subir. Límites revisados el 2026-11-17 (docs/07-exportar.md): cuando las
// fuentes no coinciden se usa el más prudente, que también sirve para publicar por API más adelante.

export type PublishTarget = {
	id: PlatformId;
	/** Nombre del formato en esa red ("YouTube Shorts"). */
	label: string;
	/** Título aparte del texto (solo YouTube). */
	title: { max: number } | null;
	caption: {
		max: number;
		/** Caracteres que se ven antes de "más": ahí debe ir el gancho. */
		visible: number;
	};
	hashtags: { max: number; recommended: number };
	/** Duración máxima en segundos para este formato (null = sin límite publicado). */
	maxSeconds: number | null;
	/** Página para subir el video a mano. */
	uploadUrl: string;
	/** Nota que se muestra junto a los límites. */
	note?: string;
};

export const PUBLISH_TARGETS: readonly PublishTarget[] = [
	{
		id: "youtube",
		label: "YouTube Shorts",
		title: { max: 100 },
		caption: { max: 5000, visible: 100 },
		// YouTube ignora todos los hashtags de un video si tiene más de 60.
		hashtags: { max: 15, recommended: 3 },
		maxSeconds: 180,
		uploadUrl: "https://studio.youtube.com/",
		note: "Los 3 primeros hashtags aparecen sobre el título.",
	},
	{
		id: "instagram",
		label: "Instagram Reels",
		title: null,
		caption: { max: 2200, visible: 125 },
		hashtags: { max: 30, recommended: 5 },
		maxSeconds: 180,
		uploadUrl: "https://www.instagram.com/",
	},
	{
		id: "tiktok",
		label: "TikTok",
		title: null,
		// En la app admite 4000; por API, 2200: se usa el menor.
		caption: { max: 2200, visible: 100 },
		hashtags: { max: 30, recommended: 5 },
		maxSeconds: 600,
		uploadUrl: "https://www.tiktok.com/tiktokstudio/upload",
	},
	{
		id: "facebook",
		label: "Facebook Reels",
		title: null,
		caption: { max: 2200, visible: 125 },
		hashtags: { max: 30, recommended: 3 },
		maxSeconds: null,
		uploadUrl: "https://www.facebook.com/reels/create",
		note: "Sin límite de duración en la app (por API, 90 s).",
	},
];

export const publishTarget = (id: PlatformId): PublishTarget => {
	const target = PUBLISH_TARGETS.find((t) => t.id === id);
	if (!target) throw new Error(`Red desconocida: ${id}`);
	return target;
};

const hashtag = z.string().regex(/^#[\p{L}\p{N}_]+$/u, "Hashtag no válido");

/** Lo que se publica en una red: título (YouTube), texto y hashtags (sin repetir los del texto). */
export const postDraftSchema = z.object({
	title: z.string().trim().default(""),
	caption: z.string().trim().default(""),
	hashtags: z.array(hashtag).default([]),
});
export type PostDraft = z.infer<typeof postDraftSchema>;

export type PostSource = {
	/** Título del video (storyboard). */
	title: string;
	/** Narraciones de las escenas, en orden. */
	narrations: readonly string[];
	/** Llamada a la acción de la marca. */
	ctaText: string;
	/** Hashtags por defecto de la marca. */
	hashtags: readonly string[];
};

/** "#Hola" / "hola" / "#hola!" → "#hola" (o null si no queda nada válido). */
export function normalizeHashtag(raw: string): string | null {
	const body = raw
		.trim()
		.replace(/^#+/, "")
		.normalize("NFC")
		.replace(/[^\p{L}\p{N}_]/gu, "");
	return body ? `#${body}` : null;
}

/** Primera frase (el gancho): lo que debe verse antes del "más". */
function hook(narrations: readonly string[]): string {
	const first = narrations.find((n) => n.trim())?.trim() ?? "";
	const sentence = first.match(/^.*?[.!?…](\s|$)/)?.[0] ?? first;
	return sentence.trim();
}

/** Texto de partida para una red, a partir del video y la marca (sin IA). */
export function draftPost(target: PublishTarget, source: PostSource): PostDraft {
	const lines = [hook(source.narrations), source.ctaText.trim()].filter(Boolean);
	const tags = [...new Set(source.hashtags.map(normalizeHashtag).filter(Boolean))] as string[];
	return {
		title: target.title ? truncate(source.title.trim(), target.title.max) : "",
		caption: lines.join("\n\n"),
		hashtags: tags.slice(0, target.hashtags.recommended),
	};
}

const truncate = (text: string, max: number) =>
	text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

/** Texto final para pegar: el texto, una línea en blanco y los hashtags. */
export function composeCaption(post: PostDraft): string {
	return [post.caption.trim(), post.hashtags.join(" ")].filter(Boolean).join("\n\n");
}

export type PostIssue = { level: "error" | "warning"; message: string };

/** Comprobaciones antes de subir: límites de la red, formato, duración y si el MP4 está al día. */
export function checkPost(
	target: PublishTarget,
	post: PostDraft,
	video: { seconds: number; format: "9:16" | "16:9"; renderUpToDate: boolean },
): PostIssue[] {
	const issues: PostIssue[] = [];
	const text = composeCaption(post);
	if (target.title) {
		if (!post.title.trim()) issues.push({ level: "error", message: "Falta el título." });
		else if (post.title.length > target.title.max)
			issues.push({
				level: "error",
				message: `El título tiene ${post.title.length} caracteres (máximo ${target.title.max}).`,
			});
	}
	if (text.length > target.caption.max)
		issues.push({
			level: "error",
			message: `El texto con hashtags tiene ${text.length} caracteres (máximo ${target.caption.max}).`,
		});
	if (post.hashtags.length > target.hashtags.max)
		issues.push({
			level: "error",
			message: `${post.hashtags.length} hashtags: ${target.label} admite ${target.hashtags.max}.`,
		});
	else if (post.hashtags.length > target.hashtags.recommended)
		issues.push({
			level: "warning",
			message: `Se recomiendan ${target.hashtags.recommended} hashtags o menos en ${target.label}.`,
		});
	if (target.maxSeconds !== null && video.seconds > target.maxSeconds)
		issues.push({
			level: "error",
			message: `El video dura ${Math.round(video.seconds)} s y ${target.label} admite ${formatSeconds(target.maxSeconds)}.`,
		});
	if (video.format !== "9:16")
		issues.push({
			level: "warning",
			message: `El video es horizontal: ${target.label} está pensado para vertical (9:16).`,
		});
	if (!video.renderUpToDate)
		issues.push({
			level: "warning",
			message: "El MP4 es de una versión anterior del video: vuelve a crearlo antes de exportar.",
		});
	return issues;
}

const formatSeconds = (s: number) => (s % 60 === 0 ? `${s / 60} min` : `${s} s`);

/** Nombre de archivo seguro a partir del título ("¿Por qué Marte es rojo?" → "por-que-marte-es-rojo"). */
export function fileSlug(text: string): string {
	return (
		text
			.normalize("NFD")
			.replace(/\p{M}/gu, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 60) || "video"
	);
}

/** Archivo de texto que acompaña al MP4 exportado. */
export function exportNotes(target: PublishTarget, post: PostDraft): string {
	const parts = [`${target.label}`, ""];
	if (target.title) parts.push("TÍTULO", post.title, "");
	parts.push(target.title ? "DESCRIPCIÓN" : "TEXTO", composeCaption(post), "");
	parts.push(`Subir en: ${target.uploadUrl}`, "");
	return parts.join("\n");
}

// ── Mejorar con IA ─────────────────────────────────────────────────────────

/** Lo que pide la IA: un texto por red (esquema plano, válido para modelos pequeños). */
export const aiPostsSchema = z.object({
	posts: z.array(
		z.object({
			platform: z.enum(["youtube", "instagram", "tiktok", "facebook"]),
			title: z.string(),
			caption: z.string(),
			hashtags: z.array(z.string()),
		}),
	),
});

export function aiPostsPrompt(source: PostSource & { language: string; channel: string }) {
	const limits = PUBLISH_TARGETS.map(
		(t) =>
			`- ${t.id} (${t.label}): ${t.title ? `título de hasta ${t.title.max} caracteres; ` : "título vacío; "}texto de hasta ${Math.min(t.caption.max, 600)} caracteres con el gancho en los primeros ${t.caption.visible}; ${t.hashtags.recommended} hashtags.`,
	).join("\n");
	return [
		{
			role: "system" as const,
			content: `Escribes los textos de publicación de videos cortos del canal "${source.channel}" en ${source.language === "en" ? "inglés" : "español"}.
Para cada red devuelve título (solo YouTube), texto y hashtags:
${limits}
Cada red tiene su estilo: el texto de cada una debe ser DISTINTO (no copies el mismo en las cuatro).
- youtube: título claro con la palabra clave del tema; descripción de 2 o 3 frases que resuma lo que aprende quien lo ve.
- instagram: primera línea que enganche, una línea en blanco, el dato principal y una pregunta al público para que comente.
- tiktok: muy corto (1 o 2 frases, menos de 150 caracteres), directo y con curiosidad.
- facebook: tono conversacional de 2 frases, como si se lo contaras a un amigo.
Reglas: no empieces con "¿Sabías que"; no inventes datos que no estén en la narración; termina con la llamada a la acción del canal; los hashtags van aparte (sin "#" dentro del texto), específicos del tema y en minúsculas; sin emojis en el título. Responde solo con el JSON.`,
		},
		{
			role: "user" as const,
			content: `Título: ${source.title}
Llamada a la acción: ${source.ctaText || "(ninguna)"}
Hashtags habituales del canal: ${source.hashtags.join(" ") || "(ninguno)"}
Narración:
${source.narrations.map((n, i) => `${i + 1}. ${n}`).join("\n")}`,
		},
	];
}

/**
 * Respuesta de la IA → borradores válidos por red: recorta, quita los hashtags del texto y, si la
 * IA olvidó la llamada a la acción del canal, la añade al final.
 */
export function postsFromAi(
	raw: z.infer<typeof aiPostsSchema>,
	options: { ctaText?: string } = {},
): Partial<Record<PlatformId, PostDraft>> {
	const cta = options.ctaText?.trim() ?? "";
	const out: Partial<Record<PlatformId, PostDraft>> = {};
	for (const post of raw.posts) {
		const target = publishTarget(post.platform);
		const hashtags = [...new Set(post.hashtags.map(normalizeHashtag).filter(Boolean))] as string[];
		const caption = post.caption
			.trim()
			.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "")
			.trim();
		out[post.platform] = {
			title: target.title ? truncate(post.title.trim(), target.title.max) : "",
			caption: withCta(caption, cta),
			hashtags: hashtags.slice(0, target.hashtags.recommended),
		};
	}
	return out;
}

/** Añade la llamada a la acción si el texto no la trae ya (sin mirar mayúsculas ni el punto final). */
const withCta = (caption: string, cta: string) =>
	!cta || caption.toLowerCase().includes(cta.toLowerCase().replace(/[.!]+$/, ""))
		? caption
		: `${caption}\n\n${cta}`;

/** Publicación manual de un video en una red (lo que ve la interfaz). */
export type PublicationView = {
	id: string;
	platform: PlatformId;
	status: "draft" | "exported" | "published";
	post: PostDraft;
	/** Carpeta exportada (MP4, portada y texto). */
	exportPath: string | null;
	/** Versión del storyboard del MP4 exportado. */
	exportedVersion: number | null;
	url: string | null;
	publishedAt: string | null;
	updatedAt: string | null;
};

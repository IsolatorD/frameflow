// Esquema SQLite de Frameflow. Ver docs/02-modelo-de-datos.md.
// Convenciones: ids UUID (texto), fechas ISO-8601 (texto), JSON en columnas de texto.
import type { BrandKit, Language } from "@frameflow/core/project";
import type { Storyboard, VideoFormat } from "@frameflow/core/storyboard";
import type { VideoStatus } from "@frameflow/core/video";
import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const createdAt = () =>
	text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);
const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

// ── Marca y configuración ────────────────────────────────────────────────

export const projects = sqliteTable(
	"projects",
	{
		id: id(),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		description: text("description").notNull().default(""),
		presetId: text("preset_id").notNull(),
		languages: json<Language[]>("languages").notNull(),
		defaultFormat: text("default_format").$type<VideoFormat>().notNull().default("9:16"),
		createdAt: createdAt(),
		archivedAt: text("archived_at"),
	},
	(t) => [uniqueIndex("projects_slug_unique").on(t.slug)],
);

export const brandKits = sqliteTable("brand_kits", {
	projectId: text("project_id")
		.primaryKey()
		.references(() => projects.id, { onDelete: "cascade" }),
	data: json<BrandKit>("data").notNull(),
	logoAssetId: text("logo_asset_id"),
	mascotAssetId: text("mascot_asset_id"),
	introAssetId: text("intro_asset_id"),
	outroAssetId: text("outro_asset_id"),
	musicAssetId: text("music_asset_id"),
	updatedAt: createdAt(),
});

export const assets = sqliteTable(
	"assets",
	{
		id: id(),
		// null = biblioteca global
		projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
		kind: text("kind")
			.$type<"image" | "logo" | "mascot" | "music" | "sfx" | "font" | "recording">()
			.notNull(),
		path: text("path").notNull(),
		sha256: text("sha256").notNull(),
		license: text("license"),
		source: text("source").$type<"generated" | "uploaded" | "bundled">().notNull(),
		createdAt: createdAt(),
	},
	(t) => [index("assets_project_idx").on(t.projectId)],
);

// ── Contenido ────────────────────────────────────────────────────────────

export const ideas = sqliteTable(
	"ideas",
	{
		id: id(),
		projectId: text("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		topic: text("topic").notNull(),
		notes: text("notes").notNull().default(""),
		source: text("source").$type<"manual" | "ai">().notNull(),
		status: text("status").$type<"new" | "used" | "discarded">().notNull().default("new"),
		videoId: text("video_id"),
		createdAt: createdAt(),
	},
	(t) => [index("ideas_project_idx").on(t.projectId)],
);

export const videos = sqliteTable(
	"videos",
	{
		id: id(),
		projectId: text("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		topic: text("topic").notNull(),
		mode: text("mode").$type<"auto" | "stepwise">().notNull(),
		status: text("status").$type<VideoStatus>().notNull().default("draft"),
		/** Último error del flujo (guion, voz o render); null si fue bien. */
		error: text("error"),
		createdAt: createdAt(),
		updatedAt: createdAt(),
	},
	(t) => [index("videos_project_idx").on(t.projectId)],
);

export const variants = sqliteTable(
	"variants",
	{
		id: id(),
		videoId: text("video_id")
			.notNull()
			.references(() => videos.id, { onDelete: "cascade" }),
		language: text("language").notNull(),
		format: text("format").$type<VideoFormat>().notNull(),
		currentVersionId: text("current_version_id"),
		sourceVariantId: text("source_variant_id"),
	},
	(t) => [uniqueIndex("variants_video_lang_format").on(t.videoId, t.language, t.format)],
);

export const storyboardVersions = sqliteTable(
	"storyboard_versions",
	{
		id: id(),
		variantId: text("variant_id")
			.notNull()
			.references(() => variants.id, { onDelete: "cascade" }),
		number: integer("number").notNull(),
		storyboard: json<Storyboard>("storyboard").notNull(),
		source: text("source").$type<"ai" | "manual" | "voice" | "editor" | "translation">().notNull(),
		parentId: text("parent_id"),
		createdAt: createdAt(),
	},
	(t) => [uniqueIndex("storyboard_versions_variant_number").on(t.variantId, t.number)],
);

export const renders = sqliteTable("renders", {
	id: id(),
	variantId: text("variant_id")
		.notNull()
		.references(() => variants.id, { onDelete: "cascade" }),
	storyboardVersionId: text("storyboard_version_id")
		.notNull()
		.references(() => storyboardVersions.id),
	status: text("status").$type<"queued" | "rendering" | "done" | "failed">().notNull(),
	path: text("path"),
	durationSec: real("duration_sec"),
	sizeBytes: integer("size_bytes"),
	width: integer("width"),
	height: integer("height"),
	startedAt: text("started_at"),
	finishedAt: text("finished_at"),
	error: text("error"),
});

// ── Distribución ─────────────────────────────────────────────────────────

export type Platform = "youtube" | "instagram" | "facebook" | "tiktok";

export const socialAccounts = sqliteTable(
	"social_accounts",
	{
		id: id(),
		projectId: text("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		platform: text("platform").$type<Platform>().notNull(),
		externalId: text("external_id").notNull(),
		handle: text("handle").notNull(),
		displayName: text("display_name").notNull(),
		language: text("language"), // null = todos los idiomas (decisión inicial)
		status: text("status").$type<"connected" | "expired" | "revoked">().notNull(),
		scopes: json<string[]>("scopes").notNull(),
		tokenRef: text("token_ref").notNull(), // clave en el llavero del sistema, nunca el token
		connectedAt: createdAt(),
		lastSyncAt: text("last_sync_at"),
	},
	(t) => [uniqueIndex("social_accounts_platform_external").on(t.platform, t.externalId)],
);

export type PublicationStatus =
	| "draft"
	| "exported"
	| "scheduled"
	| "publishing"
	| "published"
	| "failed";

export const publications = sqliteTable("publications", {
	id: id(),
	renderId: text("render_id")
		.notNull()
		.references(() => renders.id),
	/** Cuenta por la que se publica (modo api). En modo manual (exportar y subir a mano) puede faltar. */
	socialAccountId: text("social_account_id").references(() => socialAccounts.id),
	/** Red de destino (en modo manual no hay cuenta de la que sacarla). */
	platform: text("platform").$type<Platform>(),
	mode: text("mode").$type<"api" | "manual">().notNull(),
	status: text("status").$type<PublicationStatus>().notNull().default("draft"),
	title: text("title").notNull(),
	caption: text("caption").notNull().default(""),
	hashtags: json<string[]>("hashtags").notNull(),
	privacy: text("privacy").$type<"public" | "private" | "unlisted">().notNull().default("public"),
	scheduledAt: text("scheduled_at"),
	publishedAt: text("published_at"),
	externalPostId: text("external_post_id"),
	url: text("url"),
	error: text("error"),
	/** Carpeta con el MP4, la portada y el texto (modo manual). */
	exportPath: text("export_path"),
	updatedAt: text("updated_at"),
});

// ── Métricas (series temporales) ─────────────────────────────────────────

export const postMetrics = sqliteTable(
	"post_metrics",
	{
		id: id(),
		publicationId: text("publication_id")
			.notNull()
			.references(() => publications.id, { onDelete: "cascade" }),
		capturedAt: createdAt(),
		views: integer("views"),
		likes: integer("likes"),
		comments: integer("comments"),
		shares: integer("shares"),
		saves: integer("saves"),
		watchTimeSec: real("watch_time_sec"),
		avgViewDurationSec: real("avg_view_duration_sec"),
		retentionPct: real("retention_pct"),
		followersGained: integer("followers_gained"),
		raw: json<unknown>("raw"),
	},
	(t) => [index("post_metrics_pub_time").on(t.publicationId, t.capturedAt)],
);

export const accountMetrics = sqliteTable(
	"account_metrics",
	{
		id: id(),
		socialAccountId: text("social_account_id")
			.notNull()
			.references(() => socialAccounts.id, { onDelete: "cascade" }),
		capturedAt: createdAt(),
		followers: integer("followers"),
		totalViews: integer("total_views"),
		raw: json<unknown>("raw"),
	},
	(t) => [index("account_metrics_acc_time").on(t.socialAccountId, t.capturedAt)],
);

// ── Infraestructura ──────────────────────────────────────────────────────

export const jobs = sqliteTable(
	"jobs",
	{
		id: id(),
		projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
		type: text("type")
			.$type<"script" | "voice" | "captions" | "render" | "publish" | "sync_metrics">()
			.notNull(),
		targetId: text("target_id"),
		status: text("status")
			.$type<"queued" | "running" | "done" | "failed" | "cancelled">()
			.notNull()
			.default("queued"),
		progress: real("progress").notNull().default(0),
		payload: json<unknown>("payload"),
		error: text("error"),
		attempts: integer("attempts").notNull().default(0),
		createdAt: createdAt(),
		startedAt: text("started_at"),
		finishedAt: text("finished_at"),
	},
	(t) => [index("jobs_status_idx").on(t.status)],
);

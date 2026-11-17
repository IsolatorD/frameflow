PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_publications` (
	`id` text PRIMARY KEY NOT NULL,
	`render_id` text NOT NULL,
	`social_account_id` text,
	`platform` text,
	`mode` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`title` text NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`hashtags` text NOT NULL,
	`privacy` text DEFAULT 'public' NOT NULL,
	`scheduled_at` text,
	`published_at` text,
	`external_post_id` text,
	`url` text,
	`error` text,
	`export_path` text,
	`updated_at` text,
	FOREIGN KEY (`render_id`) REFERENCES `renders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`social_account_id`) REFERENCES `social_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_publications`("id", "render_id", "social_account_id", "mode", "status", "title", "caption", "hashtags", "privacy", "scheduled_at", "published_at", "external_post_id", "url", "error") SELECT "id", "render_id", "social_account_id", "mode", "status", "title", "caption", "hashtags", "privacy", "scheduled_at", "published_at", "external_post_id", "url", "error" FROM `publications`;--> statement-breakpoint
DROP TABLE `publications`;--> statement-breakpoint
ALTER TABLE `__new_publications` RENAME TO `publications`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
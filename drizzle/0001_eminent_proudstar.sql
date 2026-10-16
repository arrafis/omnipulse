CREATE TABLE `feed_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`source` text NOT NULL,
	`published_at` text NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feed_items_url_unique` ON `feed_items` (`url`);--> statement-breakpoint
CREATE INDEX `idx_feed_items_published` ON `feed_items` (`published_at`);--> statement-breakpoint
CREATE TABLE `feed_sync` (
	`id` integer PRIMARY KEY NOT NULL,
	`checked_at` text,
	`success_at` text,
	`next_at` text NOT NULL,
	`error` text
);

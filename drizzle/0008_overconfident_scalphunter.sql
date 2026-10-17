CREATE TABLE `learning_topics` (
	`slug` text PRIMARY KEY NOT NULL,
	`concept_key` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`level` text NOT NULL,
	`content` text NOT NULL,
	`added_date` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_topics_concept_key_unique` ON `learning_topics` (`concept_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `learning_topics_added_date_unique` ON `learning_topics` (`added_date`);--> statement-breakpoint
CREATE TABLE `story_contexts` (
	`url` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`why` text NOT NULL,
	`watch` text NOT NULL,
	`sources` text NOT NULL,
	`updated_at` text NOT NULL
);

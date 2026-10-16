CREATE TABLE `newsletter_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subscriber_id` integer NOT NULL,
	`delivery_date` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempted_at` text NOT NULL,
	`sent_at` text,
	`provider_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_newsletter_once_per_day` ON `newsletter_deliveries` (`subscriber_id`,`delivery_date`);--> statement-breakpoint
ALTER TABLE `feed_items` ADD `summary` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscribers` ADD `confirmed_at` text;--> statement-breakpoint
ALTER TABLE `subscribers` ADD `confirm_token_hash` text;--> statement-breakpoint
ALTER TABLE `subscribers` ADD `confirm_expires_at` text;--> statement-breakpoint
ALTER TABLE `subscribers` ADD `confirm_sent_at` text;--> statement-breakpoint
ALTER TABLE `subscribers` ADD `premium_interest` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `subscribers` ADD `plan` text DEFAULT 'free' NOT NULL;
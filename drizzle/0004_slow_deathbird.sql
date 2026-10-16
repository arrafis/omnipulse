ALTER TABLE `subscribers` ADD `preferred_categories` text DEFAULT 'AI,Tech,Markets' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscribers` ADD `stripe_customer_id` text;--> statement-breakpoint
ALTER TABLE `subscribers` ADD `stripe_subscription_id` text;--> statement-breakpoint
ALTER TABLE `subscribers` ADD `stripe_subscription_status` text;
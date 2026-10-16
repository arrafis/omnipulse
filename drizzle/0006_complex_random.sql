CREATE TABLE `premium_test_checkout` (
	`subscriber_id` integer PRIMARY KEY NOT NULL,
	`session_id` text,
	`checkout_url` text,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `premium_test_state` (
	`subscriber_id` integer PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`status` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`updated_at` text NOT NULL
);

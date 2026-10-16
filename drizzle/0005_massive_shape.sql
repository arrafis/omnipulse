CREATE TABLE `premium_checkout` (
	`subscriber_id` integer PRIMARY KEY NOT NULL,
	`session_id` text,
	`checkout_url` text,
	`expires_at` text NOT NULL
);

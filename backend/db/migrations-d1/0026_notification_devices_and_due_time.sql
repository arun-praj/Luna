ALTER TABLE `notification_settings` ADD `recurring_due_time` text DEFAULT '09:00' NOT NULL;
--> statement-breakpoint
ALTER TABLE `notification_deliveries` ADD `delivery_status` text DEFAULT 'sent' NOT NULL;
--> statement-breakpoint
ALTER TABLE `notification_deliveries` ADD `delivery_http_status` integer;
--> statement-breakpoint
ALTER TABLE `notification_deliveries` ADD `delivery_error` text;
--> statement-breakpoint
ALTER TABLE `notification_deliveries` ADD `attempted_device_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `notification_deliveries` ADD `delivered_device_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `notification_push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`device_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`subscription_json` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_seen_at` text,
	`last_delivery_at` text,
	`last_delivery_status` text,
	`last_delivery_http_status` integer,
	`last_delivery_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_push_subscriptions_user_device_unique` ON `notification_push_subscriptions` (`user_id`,`device_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_push_subscriptions_endpoint_unique` ON `notification_push_subscriptions` (`endpoint`);
--> statement-breakpoint
CREATE INDEX `notification_push_subscriptions_user_active_idx` ON `notification_push_subscriptions` (`user_id`,`active`);
--> statement-breakpoint
INSERT OR IGNORE INTO `notification_push_subscriptions` (
	`id`, `user_id`, `device_id`, `endpoint`, `subscription_json`, `active`, `last_seen_at`, `created_at`, `updated_at`
)
SELECT
	'legacy-' || `user_id`,
	`user_id`,
	'legacy-' || `user_id`,
	json_extract(`push_subscription`, '$.endpoint'),
	`push_subscription`,
	1,
	datetime('now'),
	datetime('now'),
	datetime('now')
FROM `notification_settings`
WHERE `push_subscription` IS NOT NULL
	AND json_valid(`push_subscription`) = 1
	AND json_type(`push_subscription`, '$.endpoint') = 'text'
	AND length(json_extract(`push_subscription`, '$.endpoint')) > 0;

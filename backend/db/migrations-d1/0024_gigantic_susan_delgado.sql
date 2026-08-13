CREATE TABLE `storage_usage` (
	`user_id` text PRIMARY KEY NOT NULL,
	`reserved_bytes` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stored_objects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`object_key` text NOT NULL,
	`kind` text NOT NULL,
	`byte_size` integer NOT NULL,
	`content_type` text NOT NULL,
	`checksum` text NOT NULL,
	`status` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`reserved_at` text NOT NULL,
	`uploaded_at` text,
	`delete_after` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stored_objects_key_unique` ON `stored_objects` (`object_key`);--> statement-breakpoint
CREATE INDEX `stored_objects_user_status_idx` ON `stored_objects` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `stored_objects_cleanup_idx` ON `stored_objects` (`status`,`delete_after`);--> statement-breakpoint
CREATE TABLE `webauthn_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`challenge` text NOT NULL,
	`purpose` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `webauthn_challenges_user_idx` ON `webauthn_challenges` (`user_id`,`purpose`);--> statement-breakpoint
CREATE INDEX `webauthn_challenges_expiry_idx` ON `webauthn_challenges` (`expires_at`);--> statement-breakpoint
CREATE TABLE `webauthn_unlock_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `webauthn_unlock_grants_user_idx` ON `webauthn_unlock_grants` (`user_id`,`expires_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `biometric_lock_enabled` integer DEFAULT false NOT NULL;
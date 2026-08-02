PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_webauthn_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`public_key` text NOT NULL,
	`sign_count` integer DEFAULT 0 NOT NULL,
	`device_label` text,
	`last_used_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_webauthn_credentials`("id", "user_id", "credential_id", "public_key", "sign_count", "device_label", "last_used_at", "created_at") SELECT "id", "user_id", "credential_id", "public_key", "sign_count", "device_label", "last_used_at", "created_at" FROM `webauthn_credentials`;--> statement-breakpoint
DROP TABLE `webauthn_credentials`;--> statement-breakpoint
ALTER TABLE `__new_webauthn_credentials` RENAME TO `webauthn_credentials`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `webauthn_credential_id_unique` ON `webauthn_credentials` (`credential_id`);--> statement-breakpoint
CREATE INDEX `webauthn_credentials_user_idx` ON `webauthn_credentials` (`user_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `last_login_at` text;
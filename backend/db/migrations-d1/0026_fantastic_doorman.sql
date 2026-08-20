CREATE TABLE `transaction_option_memory` (
	`user_id` text NOT NULL,
	`transaction_type` text NOT NULL,
	`option_kind` text NOT NULL,
	`option_id` text NOT NULL,
	`frequency` integer DEFAULT 0 NOT NULL,
	`last_used_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `transaction_type`, `option_kind`, `option_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `transaction_option_memory_rank_idx` ON `transaction_option_memory` (`user_id`,`transaction_type`,`option_kind`,`last_used_at`,`frequency`);
--> statement-breakpoint
INSERT INTO `transaction_option_memory` (`user_id`, `transaction_type`, `option_kind`, `option_id`, `frequency`, `last_used_at`, `created_at`, `updated_at`)
SELECT `user_id`, `transaction_type`, 'account', `option_id`, COUNT(*), MAX(`used_at`), MAX(`used_at`), MAX(`used_at`)
FROM (
  SELECT `user_id`, `type` AS `transaction_type`, `account_id` AS `option_id`, COALESCE(`created_at`, `transaction_at`, `updated_at`) AS `used_at`
  FROM `transactions`
  UNION ALL
  SELECT `user_id`, `type`, `transfer_to_account_id`, COALESCE(`created_at`, `transaction_at`, `updated_at`)
  FROM `transactions`
  WHERE `transfer_to_account_id` IS NOT NULL AND `type` IN ('transfer', 'savings')
)
GROUP BY `user_id`, `transaction_type`, `option_id`;
--> statement-breakpoint
INSERT INTO `transaction_option_memory` (`user_id`, `transaction_type`, `option_kind`, `option_id`, `frequency`, `last_used_at`, `created_at`, `updated_at`)
SELECT `user_id`, `type`, 'category', `category_id`, COUNT(*), MAX(COALESCE(`created_at`, `transaction_at`, `updated_at`)), MAX(COALESCE(`created_at`, `transaction_at`, `updated_at`)), MAX(COALESCE(`created_at`, `transaction_at`, `updated_at`))
FROM `transactions`
WHERE `category_id` IS NOT NULL
GROUP BY `user_id`, `type`, `category_id`;
--> statement-breakpoint
INSERT INTO `transaction_option_memory` (`user_id`, `transaction_type`, `option_kind`, `option_id`, `frequency`, `last_used_at`, `created_at`, `updated_at`)
SELECT `user_id`, `type`, 'savings_instrument', `savings_instrument_id`, COUNT(*), MAX(COALESCE(`created_at`, `transaction_at`, `updated_at`)), MAX(COALESCE(`created_at`, `transaction_at`, `updated_at`)), MAX(COALESCE(`created_at`, `transaction_at`, `updated_at`))
FROM `transactions`
WHERE `savings_instrument_id` IS NOT NULL AND `type` = 'savings'
GROUP BY `user_id`, `type`, `savings_instrument_id`;

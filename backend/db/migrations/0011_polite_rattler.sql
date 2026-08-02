ALTER TABLE `transactions` ADD `transaction_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `transactions` SET `transaction_at` = `date` || 'T12:00:00.000Z' WHERE `transaction_at` = '';

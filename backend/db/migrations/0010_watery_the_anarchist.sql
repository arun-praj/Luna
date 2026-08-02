ALTER TABLE `transactions` ADD `title` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `transactions` SET `title` = `notes` WHERE `title` = '' AND `notes` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `recurring_templates` DROP COLUMN `title`;

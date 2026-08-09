UPDATE `accounts` SET `current_balance` = round(`current_balance`, 2);--> statement-breakpoint
UPDATE `savings_instruments` SET `current_balance` = round(`current_balance`, 2);--> statement-breakpoint
UPDATE `goals` SET `target_amount` = round(`target_amount`, 2), `allocated_amount` = round(`allocated_amount`, 2);--> statement-breakpoint
UPDATE `spending_budgets` SET `limit_amount` = round(`limit_amount`, 2);--> statement-breakpoint
UPDATE `recurring_templates` SET `amount` = round(`amount`, 2);--> statement-breakpoint
UPDATE `transactions` SET `amount` = round(`amount`, 2);

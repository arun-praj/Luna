UPDATE "accounts" SET "current_balance" = round("current_balance"::numeric, 2)::real;--> statement-breakpoint
UPDATE "savings_instruments" SET "current_balance" = round("current_balance"::numeric, 2)::real;--> statement-breakpoint
UPDATE "goals" SET "target_amount" = round("target_amount"::numeric, 2)::real, "allocated_amount" = round("allocated_amount"::numeric, 2)::real;--> statement-breakpoint
UPDATE "spending_budgets" SET "limit_amount" = round("limit_amount"::numeric, 2)::real;--> statement-breakpoint
UPDATE "recurring_templates" SET "amount" = round("amount"::numeric, 2)::real;--> statement-breakpoint
UPDATE "transactions" SET "amount" = round("amount"::numeric, 2)::real;

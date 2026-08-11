ALTER TABLE "spending_budgets" DROP CONSTRAINT "spending_budgets_category_id_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "spending_budgets" ADD CONSTRAINT "spending_budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;
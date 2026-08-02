CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"currency" text DEFAULT 'NPR' NOT NULL,
	"current_balance" real DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"background_color" text,
	"icon" text,
	"include_in_total_balance" boolean DEFAULT true NOT NULL,
	"allow_negative_balance" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"icon" text,
	"color" text
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"target_amount" real NOT NULL,
	"allocated_amount" real DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"target_date" text
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"goal_milestones_enabled" boolean DEFAULT true NOT NULL,
	"recurring_due_enabled" boolean DEFAULT true NOT NULL,
	"recurring_transaction_enabled" boolean DEFAULT false NOT NULL,
	"recurring_transaction_time" text DEFAULT '09:00' NOT NULL,
	"recurring_transaction_frequency" text DEFAULT 'monthly' NOT NULL,
	"low_balance_enabled" boolean DEFAULT false NOT NULL,
	"low_balance_threshold" integer,
	"push_subscription" text
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"channel" text NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" text NOT NULL,
	"consumed_at" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" real NOT NULL,
	"category_id" text,
	"notes" text,
	"frequency" text NOT NULL,
	"next_due_date" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"device_label" text,
	"parent_token_id" text,
	"issued_at" text NOT NULL,
	"expires_at" text NOT NULL,
	"revoked_at" text,
	"revoked_reason" text
);
--> statement-breakpoint
CREATE TABLE "savings_instrument_types" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_instruments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"current_balance" real DEFAULT 0 NOT NULL,
	"interest_rate" real,
	"icon" text DEFAULT 'Growth' NOT NULL,
	"background_color" text DEFAULT '#e5f3eb' NOT NULL,
	"maturity_date" text
);
--> statement-breakpoint
CREATE TABLE "spending_budgets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category_id" text,
	"name" text NOT NULL,
	"limit_amount" real NOT NULL,
	"period" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_history" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"changed_by" text,
	"change_type" text NOT NULL,
	"old_values" text,
	"new_values" text,
	"changed_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" real NOT NULL,
	"category_id" text,
	"title" text DEFAULT '' NOT NULL,
	"notes" text,
	"tags" text DEFAULT '[]' NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurring_template_id" text,
	"receipt_image_url" text,
	"goal_id" text,
	"savings_instrument_id" text,
	"transfer_to_account_id" text,
	"date" text NOT NULL,
	"transaction_at" text DEFAULT '' NOT NULL,
	"sync_status" text DEFAULT 'synced' NOT NULL,
	"client_generated_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"currency" text DEFAULT 'NPR' NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"otp_enabled" boolean DEFAULT false NOT NULL,
	"email_verified_at" text,
	"phone_verified_at" text,
	"last_login_at" text,
	"avatar_preset" text DEFAULT 'sunrise' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webauthn_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"sign_count" integer DEFAULT 0 NOT NULL,
	"device_label" text,
	"last_used_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_instrument_types" ADD CONSTRAINT "savings_instrument_types_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_instruments" ADD CONSTRAINT "savings_instruments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_instruments" ADD CONSTRAINT "savings_instruments_type_id_savings_instrument_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."savings_instrument_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spending_budgets" ADD CONSTRAINT "spending_budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spending_budgets" ADD CONSTRAINT "spending_budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_history" ADD CONSTRAINT "transaction_history_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_history" ADD CONSTRAINT "transaction_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurring_template_id_recurring_templates_id_fk" FOREIGN KEY ("recurring_template_id") REFERENCES "public"."recurring_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_savings_instrument_id_savings_instruments_id_fk" FOREIGN KEY ("savings_instrument_id") REFERENCES "public"."savings_instruments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transfer_to_account_id_accounts_id_fk" FOREIGN KEY ("transfer_to_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tags" ADD CONSTRAINT "user_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "categories_user_idx" ON "categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "goals_user_idx" ON "goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "otp_codes_user_purpose_idx" ON "otp_codes" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE INDEX "otp_codes_expires_at_idx" ON "otp_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "recurring_templates_user_idx" ON "recurring_templates" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_hash_unique" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_parent_idx" ON "refresh_tokens" USING btree ("parent_token_id");--> statement-breakpoint
CREATE INDEX "savings_instrument_types_user_idx" ON "savings_instrument_types" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "savings_instruments_user_idx" ON "savings_instruments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "spending_budgets_user_idx" ON "spending_budgets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transaction_history_transaction_idx" ON "transaction_history" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "transactions_user_date_idx" ON "transactions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "transactions_account_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_client_generated_id_unique" ON "transactions" USING btree ("client_generated_id");--> statement-breakpoint
CREATE INDEX "user_tags_user_idx" ON "user_tags" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_tags_user_name_unique" ON "user_tags" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_unique" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "webauthn_credential_id_unique" ON "webauthn_credentials" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "webauthn_credentials_user_idx" ON "webauthn_credentials" USING btree ("user_id");
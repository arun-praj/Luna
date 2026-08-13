CREATE TABLE "pending_registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"currency" text DEFAULT 'NPR' NOT NULL,
	"verification_code_hash" text NOT NULL,
	"verification_attempt_count" integer DEFAULT 0 NOT NULL,
	"verification_expires_at" text NOT NULL,
	"verification_claimed_at" text,
	"verification_claim_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD COLUMN "claim_id" text;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD COLUMN "claimed_at" text;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD COLUMN "finalized_at" text;--> statement-breakpoint
CREATE UNIQUE INDEX "pending_registrations_email_unique" ON "pending_registrations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "pending_registrations_expiry_idx" ON "pending_registrations" USING btree ("verification_expires_at");
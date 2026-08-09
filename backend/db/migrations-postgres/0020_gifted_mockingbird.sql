CREATE TABLE "home_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"source_id" text NOT NULL,
	"occurrence_key" text NOT NULL,
	"show_at" text NOT NULL,
	"expires_at" text,
	"shown_at" text,
	"dismissed_at" text,
	"resolved_at" text,
	"payload" text NOT NULL,
	"hard_urgency" integer DEFAULT 0 NOT NULL,
	"deterministic_rank" integer DEFAULT 0 NOT NULL,
	"ai_status" text DEFAULT 'pending' NOT NULL,
	"ai_rank" integer,
	"ai_suppressed" boolean DEFAULT false NOT NULL,
	"ai_title" text,
	"ai_detail" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "home_alerts" ADD CONSTRAINT "home_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "home_alerts_identity_unique" ON "home_alerts" USING btree ("user_id","kind","source_id","occurrence_key");--> statement-breakpoint
CREATE INDEX "home_alerts_user_visibility_idx" ON "home_alerts" USING btree ("user_id","show_at","dismissed_at","resolved_at");--> statement-breakpoint
CREATE INDEX "home_alerts_ai_pending_idx" ON "home_alerts" USING btree ("ai_status","created_at");
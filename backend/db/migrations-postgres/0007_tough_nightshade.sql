CREATE TABLE "report_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period_type" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"transaction_fingerprint" text NOT NULL,
	"report_json" text NOT NULL,
	"generated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_generation_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"day" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_cache" ADD CONSTRAINT "report_cache_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_generation_limits" ADD CONSTRAINT "report_generation_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "report_cache_unique" ON "report_cache" USING btree ("user_id","period_type","period_start");--> statement-breakpoint
CREATE INDEX "report_cache_user_idx" ON "report_cache" USING btree ("user_id","generated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "report_generation_limits_unique" ON "report_generation_limits" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "report_generation_limits_user_idx" ON "report_generation_limits" USING btree ("user_id","day");
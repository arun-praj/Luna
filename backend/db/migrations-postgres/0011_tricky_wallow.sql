ALTER TABLE "refresh_tokens" ADD COLUMN "session_family_id" text;--> statement-breakpoint
WITH RECURSIVE token_families(id, family_id) AS (
  SELECT id, id FROM refresh_tokens WHERE parent_token_id IS NULL
  UNION ALL
  SELECT child.id, token_families.family_id
  FROM refresh_tokens AS child
  JOIN token_families ON child.parent_token_id = token_families.id
)
UPDATE refresh_tokens
SET session_family_id = (SELECT family_id FROM token_families WHERE token_families.id = refresh_tokens.id)
WHERE id IN (SELECT id FROM token_families);--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_idx" ON "refresh_tokens" USING btree ("session_family_id");

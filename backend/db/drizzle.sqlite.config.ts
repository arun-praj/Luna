import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./backend/db/schema-sqlite.ts",
  out: "./backend/db/migrations-d1",
  dialect: "sqlite",
});

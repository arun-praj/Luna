import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./backend/db/schema.ts",
  out: "./backend/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.SQLITE_DATABASE_PATH ?? ".data/budget.sqlite",
  },
});

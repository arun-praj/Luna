import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { getDatabaseUrl } from "./connection";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./backend/db/schema-postgres.ts",
  out: "./backend/db/migrations-postgres",
  dialect: "postgresql",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
});

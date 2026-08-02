import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { getDatabaseUrl } from "./connection";

const connectionString = getDatabaseUrl();

const globalForDatabase = globalThis as unknown as {
  postgresPool?: Pool;
};

const pool = globalForDatabase.postgresPool ?? new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.postgresPool = pool;
}

export const db = drizzle(pool, { schema });
export { pool };

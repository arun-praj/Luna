import "server-only";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import fs from "node:fs";

import * as schema from "./schema";

const databasePath = process.env.SQLITE_DATABASE_PATH
  ? path.resolve(process.env.SQLITE_DATABASE_PATH)
  : path.join(process.cwd(), ".data", "budget.sqlite");

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const globalForDatabase = globalThis as unknown as {
  sqlite?: Database.Database;
};

const sqlite = globalForDatabase.sqlite ?? new Database(databasePath);

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.sqlite = sqlite;
}

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { databasePath };

import "dotenv/config";
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import crypto from "node:crypto";

config({ path: ".env.local", override: false });

const rawConnectionString = process.env.DATABASE_URL;
if (!rawConnectionString) throw new Error("DATABASE_URL is required to seed PostgreSQL.");
const connectionUrl = new URL(rawConnectionString);
if (["localhost", "127.0.0.1", "::1"].includes(connectionUrl.hostname)) {
  connectionUrl.searchParams.delete("sslmode");
  connectionUrl.searchParams.delete("ssl");
}
const connectionString = connectionUrl.toString();

const email = (process.env.DEMO_USER_EMAIL ?? "arun@example.com").trim().toLowerCase();
const password = process.env.DEMO_USER_PASSWORD ?? "password123";
const name = process.env.DEMO_USER_NAME ?? "Arun";
const pool = new Pool({ connectionString });

try {
  const timestamp = new Date().toISOString();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);

  if (existing.rows[0]) {
    await pool.query(
      "UPDATE users SET name = $1, password_hash = $2, currency = $3, otp_enabled = $4, email_verified_at = COALESCE(email_verified_at, $5), updated_at = $5 WHERE id = $6",
      [name, passwordHash, "NPR", false, timestamp, existing.rows[0].id],
    );
    console.log(`Updated demo user: ${email}`);
  } else {
    await pool.query(
      "INSERT INTO users (id, name, email, password_hash, currency, otp_enabled, email_verified_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
      [crypto.randomUUID(), name, email, passwordHash, "NPR", false, timestamp, timestamp, timestamp],
    );
    console.log(`Created demo user: ${email}`);
  }

  console.log("Password: use DEMO_USER_PASSWORD when overriding the default");
} finally {
  await pool.end();
}

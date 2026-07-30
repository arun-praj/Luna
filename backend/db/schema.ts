import {
  integer,
  index,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const isoTimestamp = (name: string) => text(name).notNull();
const optionalIsoTimestamp = (name: string) => text(name);

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    currency: text("currency").notNull().default("NPR"),
    otpEnabled: integer("otp_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    emailVerifiedAt: optionalIsoTimestamp("email_verified_at"),
    phoneVerifiedAt: optionalIsoTimestamp("phone_verified_at"),
    createdAt: isoTimestamp("created_at"),
    updatedAt: isoTimestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_phone_unique").on(table.phone),
  ],
);

export const otpCodes = sqliteTable(
  "otp_codes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    channel: text("channel", { enum: ["email", "sms"] }).notNull(),
    purpose: text("purpose", {
      enum: ["login", "signup_verify", "password_reset", "step_up"],
    }).notNull(),
    expiresAt: isoTimestamp("expires_at"),
    consumedAt: optionalIsoTimestamp("consumed_at"),
    attemptCount: integer("attempt_count").notNull().default(0),
    createdAt: isoTimestamp("created_at"),
  },
  (table) => [
    index("otp_codes_user_purpose_idx").on(table.userId, table.purpose),
    index("otp_codes_expires_at_idx").on(table.expiresAt),
  ],
);

export const webauthnCredentials = sqliteTable(
  "webauthn_credentials",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialId: text("credential_id").notNull(),
    publicKey: text("public_key").notNull(),
    signCount: integer("sign_count").notNull().default(0),
    deviceLabel: text("device_label"),
    lastUsedAt: optionalIsoTimestamp("last_used_at"),
    createdAt: isoTimestamp("created_at"),
  },
  (table) => [
    uniqueIndex("webauthn_credential_id_unique").on(table.credentialId),
    index("webauthn_credentials_user_idx").on(table.userId),
  ],
);

export const refreshTokens = sqliteTable(
  "refresh_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    deviceLabel: text("device_label"),
    parentTokenId: text("parent_token_id"),
    issuedAt: isoTimestamp("issued_at"),
    expiresAt: isoTimestamp("expires_at"),
    revokedAt: optionalIsoTimestamp("revoked_at"),
    revokedReason: text("revoked_reason", {
      enum: ["logout", "rotated", "reuse_detected", "admin"],
    }),
  },
  (table) => [
    uniqueIndex("refresh_tokens_hash_unique").on(table.tokenHash),
    index("refresh_tokens_user_idx").on(table.userId),
    index("refresh_tokens_parent_idx").on(table.parentTokenId),
  ],
);

export const schema = {
  users,
  otpCodes,
  webauthnCredentials,
  refreshTokens,
};

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

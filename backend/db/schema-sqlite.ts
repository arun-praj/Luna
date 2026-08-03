// SQLite schema used by Cloudflare D1 and local Wrangler development.
import {
  integer,
  index,
  sqliteTable,
  real,
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
    onboardingCompleted: integer("onboarding_completed", { mode: "boolean" })
      .notNull()
      .default(false),
    tutorialStartedAt: optionalIsoTimestamp("tutorial_started_at"),
    tutorialCompletedAt: optionalIsoTimestamp("tutorial_completed_at"),
    otpEnabled: integer("otp_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    twoFactorSecretEncrypted: text("two_factor_secret_encrypted"),
    twoFactorSetupSecretEncrypted: text("two_factor_setup_secret_encrypted"),
    twoFactorBackupCodes: text("two_factor_backup_codes"),
    twoFactorVerifiedAt: optionalIsoTimestamp("two_factor_verified_at"),
    emailVerifiedAt: optionalIsoTimestamp("email_verified_at"),
    phoneVerifiedAt: optionalIsoTimestamp("phone_verified_at"),
    pwaInstallDismissedAt: optionalIsoTimestamp("pwa_install_dismissed_at"),
    lastLoginAt: optionalIsoTimestamp("last_login_at"),
    avatarPreset: text("avatar_preset").notNull().default("sunrise"),
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

export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: isoTimestamp("expires_at"),
    usedAt: optionalIsoTimestamp("used_at"),
    createdAt: isoTimestamp("created_at"),
  },
  (table) => [
    uniqueIndex("password_reset_tokens_hash_unique").on(table.tokenHash),
    index("password_reset_tokens_user_idx").on(table.userId),
    index("password_reset_tokens_expires_at_idx").on(table.expiresAt),
  ],
);

export const notificationSettings = sqliteTable("notification_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  goalMilestonesEnabled: integer("goal_milestones_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  recurringDueEnabled: integer("recurring_due_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  recurringTransactionEnabled: integer("recurring_transaction_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  recurringTransactionTime: text("recurring_transaction_time")
    .notNull()
    .default("09:00"),
  timezone: text("timezone")
    .notNull()
    .default("UTC"),
  recurringTransactionFrequency: text("recurring_transaction_frequency", {
    enum: ["daily", "weekly", "monthly"],
  })
    .notNull()
    .default("monthly"),
  lowBalanceEnabled: integer("low_balance_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  lowBalanceThreshold: integer("low_balance_threshold"),
  pushSubscription: text("push_subscription"),
});

export const notificationDeliveries = sqliteTable(
  "notification_deliveries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["goal_milestone", "recurring_due", "recurring_transaction", "low_balance"],
    }).notNull(),
    referenceId: text("reference_id").notNull(),
    occurrenceKey: text("occurrence_key").notNull(),
    sentAt: isoTimestamp("sent_at"),
  },
  (table) => [
    uniqueIndex("notification_deliveries_unique").on(table.userId, table.kind, table.referenceId, table.occurrenceKey),
    index("notification_deliveries_user_idx").on(table.userId, table.sentAt),
  ],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type", { enum: ["checking", "cash", "credit_card", "general", "savings", "investment", "loan", "other"] }).notNull(),
    currency: text("currency").notNull().default("NPR"),
    currentBalance: real("current_balance").notNull().default(0),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    displayOrder: integer("display_order").notNull().default(0),
    backgroundColor: text("background_color"),
    icon: text("icon"),
    includeInTotalBalance: integer("include_in_total_balance", { mode: "boolean" }).notNull().default(true),
    allowNegativeBalance: integer("allow_negative_balance", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [index("accounts_user_idx").on(table.userId)],
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type", { enum: ["expense", "income"] }).notNull(),
    icon: text("icon"),
    color: text("color"),
  },
  (table) => [index("categories_user_idx").on(table.userId)],
);

export const userTags = sqliteTable(
  "user_tags",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: isoTimestamp("created_at"),
  },
  (table) => [index("user_tags_user_idx").on(table.userId), uniqueIndex("user_tags_user_name_unique").on(table.userId, table.name)],
);

export const savingsInstrumentTypes = sqliteTable(
  "savings_instrument_types",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [index("savings_instrument_types_user_idx").on(table.userId)],
);

export const savingsInstruments = sqliteTable(
  "savings_instruments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    typeId: text("type_id").notNull().references(() => savingsInstrumentTypes.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    currentBalance: real("current_balance").notNull().default(0),
    interestRate: real("interest_rate"),
    icon: text("icon").notNull().default("Growth"),
    backgroundColor: text("background_color").notNull().default("#e5f3eb"),
    maturityDate: text("maturity_date"),
  },
  (table) => [index("savings_instruments_user_idx").on(table.userId)],
);

export const goals = sqliteTable(
  "goals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetAmount: real("target_amount").notNull(),
    allocatedAmount: real("allocated_amount").notNull().default(0),
    status: text("status", { enum: ["active", "completed", "archived"] }).notNull().default("active"),
    targetDate: text("target_date"),
  },
  (table) => [index("goals_user_idx").on(table.userId)],
);

export const spendingBudgets = sqliteTable(
  "spending_budgets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    limitAmount: real("limit_amount").notNull(),
    period: text("period", { enum: ["weekly", "monthly", "yearly"] }).notNull(),
  },
  (table) => [index("spending_budgets_user_idx").on(table.userId)],
);

export const recurringTemplates = sqliteTable(
  "recurring_templates",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull().references(() => accounts.id),
    type: text("type", { enum: ["expense", "income", "savings", "transfer"] }).notNull(),
    amount: real("amount").notNull(),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    notes: text("notes"),
    frequency: text("frequency", { enum: ["daily", "weekly", "monthly", "yearly"] }).notNull(),
    nextDueDate: text("next_due_date").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [index("recurring_templates_user_idx").on(table.userId)],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull().references(() => accounts.id),
    type: text("type", { enum: ["expense", "income", "savings", "transfer", "adjust_balance"] }).notNull(),
    amount: real("amount").notNull(),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    title: text("title").notNull().default(""),
    notes: text("notes"),
    tags: text("tags").notNull().default("[]"),
    isRecurring: integer("is_recurring", { mode: "boolean" }).notNull().default(false),
    recurringTemplateId: text("recurring_template_id").references(() => recurringTemplates.id, { onDelete: "set null" }),
    receiptImageUrl: text("receipt_image_url"),
    goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
    savingsInstrumentId: text("savings_instrument_id").references(() => savingsInstruments.id, { onDelete: "set null" }),
    transferToAccountId: text("transfer_to_account_id").references(() => accounts.id),
    date: text("date").notNull(),
    transactionAt: text("transaction_at").notNull().default(""),
    syncStatus: text("sync_status", { enum: ["synced", "pending", "failed"] }).notNull().default("synced"),
    clientGeneratedId: text("client_generated_id"),
    createdAt: isoTimestamp("created_at"),
    updatedAt: isoTimestamp("updated_at"),
  },
  (table) => [
    index("transactions_user_date_idx").on(table.userId, table.date),
    index("transactions_account_idx").on(table.accountId),
    uniqueIndex("transactions_client_generated_id_unique").on(table.clientGeneratedId),
  ],
);

export const transactionHistory = sqliteTable(
  "transaction_history",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
    changedBy: text("changed_by").references(() => users.id, { onDelete: "set null" }),
    changeType: text("change_type", { enum: ["created", "updated", "deleted"] }).notNull(),
    oldValues: text("old_values"),
    newValues: text("new_values"),
    changedAt: isoTimestamp("changed_at"),
  },
  (table) => [index("transaction_history_transaction_idx").on(table.transactionId)],
);

export const dataExports = sqliteTable(
  "data_exports",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    emailSnapshot: text("email_snapshot").notNull(),
    format: text("format", { enum: ["json"] }).notNull().default("json"),
    status: text("status", { enum: ["requested", "completed", "failed"] }).notNull().default("requested"),
    requestedAt: isoTimestamp("requested_at"),
    completedAt: optionalIsoTimestamp("completed_at"),
    bytes: integer("bytes"),
  },
  (table) => [
    index("data_exports_user_idx").on(table.userId),
    index("data_exports_requested_at_idx").on(table.requestedAt),
  ],
);

export const accountDeletionRequests = sqliteTable(
  "account_deletion_requests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    emailSnapshot: text("email_snapshot").notNull(),
    mode: text("mode", { enum: ["immediate", "after_30_days"] }).notNull(),
    status: text("status", { enum: ["scheduled", "completed", "cancelled"] }).notNull(),
    requestedAt: isoTimestamp("requested_at"),
    scheduledFor: optionalIsoTimestamp("scheduled_for"),
    executedAt: optionalIsoTimestamp("executed_at"),
  },
  (table) => [
    index("account_deletion_requests_user_idx").on(table.userId),
    index("account_deletion_requests_due_idx").on(table.status, table.scheduledFor),
  ],
);

export const schema = {
  users,
  otpCodes,
  webauthnCredentials,
  refreshTokens,
  passwordResetTokens,
  notificationSettings,
  accounts,
  categories,
  userTags,
  savingsInstrumentTypes,
  savingsInstruments,
  goals,
  spendingBudgets,
  recurringTemplates,
  transactions,
  transactionHistory,
  dataExports,
  accountDeletionRequests,
};

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

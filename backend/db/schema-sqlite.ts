// SQLite schema used by Cloudflare D1 and local Wrangler development.
import { sql } from "drizzle-orm";
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
    hideTotalBalance: integer("hide_total_balance", { mode: "boolean" })
      .notNull()
      .default(false),
    monthlyReportEnabled: integer("monthly_report_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    onboardingCompleted: integer("onboarding_completed", { mode: "boolean" })
      .notNull()
      .default(false),
    budgetOnboardingCompleted: integer("budget_onboarding_completed", { mode: "boolean" })
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
    biometricLockEnabled: integer("biometric_lock_enabled", { mode: "boolean" }).notNull().default(false),
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

export const authRateLimits = sqliteTable(
  "auth_rate_limits",
  {
    key: text("key").primaryKey(),
    windowStartedAt: isoTimestamp("window_started_at"),
    attempts: integer("attempts").notNull().default(0),
    updatedAt: isoTimestamp("updated_at"),
  },
  (table) => [index("auth_rate_limits_updated_idx").on(table.updatedAt)],
);

export const pendingRegistrations = sqliteTable(
  "pending_registrations",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    currency: text("currency").notNull().default("NPR"),
    verificationCodeHash: text("verification_code_hash").notNull(),
    verificationAttemptCount: integer("verification_attempt_count").notNull().default(0),
    verificationExpiresAt: isoTimestamp("verification_expires_at"),
    verificationClaimedAt: optionalIsoTimestamp("verification_claimed_at"),
    verificationClaimId: text("verification_claim_id"),
    createdAt: isoTimestamp("created_at"),
    updatedAt: isoTimestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("pending_registrations_email_unique").on(table.email),
    index("pending_registrations_expiry_idx").on(table.verificationExpiresAt),
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

export const webauthnChallenges = sqliteTable(
  "webauthn_challenges",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    challenge: text("challenge").notNull(),
    purpose: text("purpose", { enum: ["registration", "authentication"] }).notNull(),
    expiresAt: isoTimestamp("expires_at"),
    consumedAt: optionalIsoTimestamp("consumed_at"),
    createdAt: isoTimestamp("created_at"),
  },
  (table) => [index("webauthn_challenges_user_idx").on(table.userId, table.purpose), index("webauthn_challenges_expiry_idx").on(table.expiresAt)],
);

export const webauthnUnlockGrants = sqliteTable(
  "webauthn_unlock_grants",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: isoTimestamp("expires_at"),
    revokedAt: optionalIsoTimestamp("revoked_at"),
    createdAt: isoTimestamp("created_at"),
  },
  (table) => [index("webauthn_unlock_grants_user_idx").on(table.userId, table.expiresAt)],
);

export const storageUsage = sqliteTable("storage_usage", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  reservedBytes: integer("reserved_bytes").notNull().default(0),
  updatedAt: isoTimestamp("updated_at"),
});

export const storedObjects = sqliteTable(
  "stored_objects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    kind: text("kind", { enum: ["account-images", "savings-images", "transaction-receipts"] }).notNull(),
    byteSize: integer("byte_size").notNull(),
    contentType: text("content_type").notNull(),
    checksum: text("checksum").notNull(),
    status: text("status", { enum: ["reserved", "uploaded", "attached", "delete_pending", "deleted", "failed"] }).notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    reservedAt: isoTimestamp("reserved_at"),
    uploadedAt: optionalIsoTimestamp("uploaded_at"),
    deleteAfter: optionalIsoTimestamp("delete_after"),
    createdAt: isoTimestamp("created_at"),
    updatedAt: isoTimestamp("updated_at"),
  },
  (table) => [uniqueIndex("stored_objects_key_unique").on(table.objectKey), index("stored_objects_user_status_idx").on(table.userId, table.status), index("stored_objects_cleanup_idx").on(table.status, table.deleteAfter)],
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
    sessionFamilyId: text("session_family_id"),
    parentTokenId: text("parent_token_id"),
    issuedAt: isoTimestamp("issued_at"),
    expiresAt: isoTimestamp("expires_at"),
    revokedAt: optionalIsoTimestamp("revoked_at"),
    revokedReason: text("revoked_reason", {
      enum: ["logout", "rotated", "reuse_detected", "admin"],
    }),
    replacementTokenCiphertext: text("replacement_token_ciphertext"),
  },
  (table) => [
    uniqueIndex("refresh_tokens_hash_unique").on(table.tokenHash),
    index("refresh_tokens_user_idx").on(table.userId),
    index("refresh_tokens_family_idx").on(table.sessionFamilyId),
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
    claimId: text("claim_id"),
    claimedAt: optionalIsoTimestamp("claimed_at"),
    finalizedAt: optionalIsoTimestamp("finalized_at"),
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
  loanPaymentDueEnabled: integer("loan_payment_due_enabled", { mode: "boolean" }).notNull().default(true),
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
      enum: ["goal_milestone", "recurring_due", "recurring_transaction", "loan_payment_due", "low_balance"],
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

export const homeAlerts = sqliteTable(
  "home_alerts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["budget", "goal", "loan", "recurring"] }).notNull(),
    sourceId: text("source_id").notNull(),
    occurrenceKey: text("occurrence_key").notNull(),
    showAt: isoTimestamp("show_at"),
    expiresAt: optionalIsoTimestamp("expires_at"),
    shownAt: optionalIsoTimestamp("shown_at"),
    dismissedAt: optionalIsoTimestamp("dismissed_at"),
    resolvedAt: optionalIsoTimestamp("resolved_at"),
    payload: text("payload").notNull(),
    hardUrgency: integer("hard_urgency").notNull().default(0),
    deterministicRank: integer("deterministic_rank").notNull().default(0),
    aiStatus: text("ai_status", { enum: ["pending", "ready", "fallback"] }).notNull().default("pending"),
    aiRank: integer("ai_rank"),
    aiSuppressed: integer("ai_suppressed", { mode: "boolean" }).notNull().default(false),
    aiTitle: text("ai_title"),
    aiDetail: text("ai_detail"),
    createdAt: isoTimestamp("created_at"),
    updatedAt: isoTimestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("home_alerts_identity_unique").on(table.userId, table.kind, table.sourceId, table.occurrenceKey),
    index("home_alerts_user_visibility_idx").on(table.userId, table.showAt, table.dismissedAt, table.resolvedAt),
    index("home_alerts_ai_pending_idx").on(table.aiStatus, table.createdAt),
  ],
);

export const reportDeliveries = sqliteTable(
  "report_deliveries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportType: text("report_type", { enum: ["monthly", "monthly_test"] }).notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    status: text("status", { enum: ["processing", "sending", "sent", "failed"] }).notNull(),
    error: text("error"),
    sentAt: optionalIsoTimestamp("sent_at"),
    createdAt: isoTimestamp("created_at"),
  },
  (table) => [
    uniqueIndex("report_deliveries_unique").on(table.userId, table.reportType, table.periodStart),
    index("report_deliveries_user_idx").on(table.userId, table.createdAt),
  ],
);

export const reportCache = sqliteTable(
  "report_cache",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    periodType: text("period_type", { enum: ["weekly", "monthly", "yearly"] }).notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    transactionFingerprint: text("transaction_fingerprint").notNull(),
    reportJson: text("report_json").notNull(),
    generatedAt: isoTimestamp("generated_at"),
  },
  (table) => [
    uniqueIndex("report_cache_unique").on(table.userId, table.periodType, table.periodStart),
    index("report_cache_user_idx").on(table.userId, table.generatedAt),
  ],
);

export const reportGenerationLimits = sqliteTable(
  "report_generation_limits",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [
    uniqueIndex("report_generation_limits_unique").on(table.userId, table.day),
    index("report_generation_limits_user_idx").on(table.userId, table.day),
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
    openingBalance: real("opening_balance").notNull().default(0),
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

export const budgetIncomeSources = sqliteTable(
  "budget_income_sources",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    amount: real("amount").notNull(),
    interval: text("interval", { enum: ["weekly", "biweekly", "twice_monthly", "monthly", "quarterly", "yearly"] }).notNull(),
    createdAt: isoTimestamp("created_at"),
    updatedAt: isoTimestamp("updated_at"),
  },
  (table) => [
    index("budget_income_sources_user_idx").on(table.userId),
    uniqueIndex("budget_income_sources_user_category_unique").on(table.userId, table.categoryId),
  ],
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
    monthlyContribution: real("monthly_contribution").notNull().default(0),
    status: text("status", { enum: ["active", "completed", "archived"] }).notNull().default("active"),
    targetDate: text("target_date"),
    accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
  },
  (table) => [index("goals_user_idx").on(table.userId)],
);

export const loans = sqliteTable(
  "loans",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    counterparty: text("counterparty"),
    direction: text("direction", { enum: ["borrowed", "lent"] }).notNull(),
    currency: text("currency").notNull(),
    originalPrincipal: real("original_principal").notNull(),
    interestMethod: text("interest_method", { enum: ["none", "reducing", "flat"] }).notNull().default("none"),
    paymentFrequency: text("payment_frequency", { enum: ["weekly", "monthly", "quarterly", "yearly"] }),
    scheduledPayment: real("scheduled_payment"),
    termCount: integer("term_count"),
    startDate: text("start_date").notNull(),
    firstDueDate: text("first_due_date"),
    nextDueDate: text("next_due_date"),
    status: text("status", { enum: ["active", "paid_off", "archived"] }).notNull().default("active"),
    notes: text("notes"),
    createdAt: isoTimestamp("created_at"),
    updatedAt: isoTimestamp("updated_at"),
  },
  (table) => [index("loans_user_idx").on(table.userId), uniqueIndex("loans_account_unique").on(table.accountId)],
);

export const loanRatePeriods = sqliteTable(
  "loan_rate_periods",
  {
    id: text("id").primaryKey(),
    loanId: text("loan_id").notNull().references(() => loans.id, { onDelete: "cascade" }),
    annualRate: real("annual_rate").notNull(),
    effectiveDate: text("effective_date").notNull(),
    createdAt: isoTimestamp("created_at"),
  },
  (table) => [index("loan_rate_periods_loan_idx").on(table.loanId), uniqueIndex("loan_rate_periods_effective_unique").on(table.loanId, table.effectiveDate)],
);

export const loanInstallments = sqliteTable(
  "loan_installments",
  {
    id: text("id").primaryKey(),
    loanId: text("loan_id").notNull().references(() => loans.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    dueDate: text("due_date").notNull(),
    expectedPrincipal: real("expected_principal").notNull().default(0),
    expectedInterest: real("expected_interest").notNull().default(0),
    expectedFees: real("expected_fees").notNull().default(0),
    paidPrincipal: real("paid_principal").notNull().default(0),
    paidInterest: real("paid_interest").notNull().default(0),
    paidFees: real("paid_fees").notNull().default(0),
    status: text("status", { enum: ["pending", "partial", "paid", "skipped"] }).notNull().default("pending"),
  },
  (table) => [index("loan_installments_loan_idx").on(table.loanId), uniqueIndex("loan_installments_sequence_unique").on(table.loanId, table.sequence)],
);

export const loanPaymentEvents = sqliteTable(
  "loan_payment_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    loanId: text("loan_id").notNull().references(() => loans.id, { onDelete: "restrict" }),
    accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
    installmentId: text("installment_id").references(() => loanInstallments.id, { onDelete: "set null" }),
    kind: text("kind", { enum: ["disbursement", "payment", "reversal"] }).notNull(),
    principal: real("principal").notNull().default(0),
    interest: real("interest").notNull().default(0),
    fees: real("fees").notNull().default(0),
    date: text("date").notNull(),
    clientGeneratedId: text("client_generated_id"),
    reversedEventId: text("reversed_event_id"),
    createdAt: isoTimestamp("created_at"),
  },
  (table) => [index("loan_payment_events_loan_idx").on(table.loanId), uniqueIndex("loan_payment_events_client_unique").on(table.clientGeneratedId)],
);

export const spendingBudgets = sqliteTable(
  "spending_budgets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    limitAmount: real("limit_amount").notNull(),
    period: text("period", { enum: ["weekly", "monthly", "yearly"] }).notNull(),
    clientGeneratedId: text("client_generated_id"),
    createdAt: isoTimestamp("created_at"),
    updatedAt: isoTimestamp("updated_at"),
  },
  (table) => [
    index("spending_budgets_user_idx").on(table.userId),
    uniqueIndex("spending_budgets_client_unique").on(table.clientGeneratedId),
    uniqueIndex("spending_budgets_overall_period_unique").on(table.userId, table.period).where(sql`${table.categoryId} IS NULL`),
    uniqueIndex("spending_budgets_category_period_unique").on(table.userId, table.period, table.categoryId).where(sql`${table.categoryId} IS NOT NULL`),
  ],
);

export const budgetTemplates = sqliteTable(
  "budget_templates",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "restrict" }),
    kind: text("kind", { enum: ["expense", "savings"] }).notNull().default("expense"),
    name: text("name").notNull(),
    recurrence: text("recurrence", { enum: ["weekly", "monthly", "yearly"] }).notNull(),
    defaultAmount: real("default_amount").notNull(),
    rolloverRule: text("rollover_rule", { enum: ["none", "cap", "uncapped"] }).notNull().default("none"),
    clientGeneratedId: text("client_generated_id"),
    createdAt: isoTimestamp("created_at"),
    updatedAt: isoTimestamp("updated_at"),
  },
  (table) => [
    index("budget_templates_user_idx").on(table.userId),
    uniqueIndex("budget_templates_client_unique").on(table.clientGeneratedId),
    uniqueIndex("budget_templates_category_scope_unique").on(table.userId, table.recurrence, table.kind, table.categoryId).where(sql`${table.categoryId} IS NOT NULL`),
    uniqueIndex("budget_templates_overall_scope_unique").on(table.userId, table.recurrence, table.kind).where(sql`${table.categoryId} IS NULL`),
  ],
);

export const budgetPeriods = sqliteTable(
  "budget_periods",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    recurrence: text("recurrence", { enum: ["weekly", "monthly", "yearly"] }).notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    totalLimit: real("total_limit").notNull().default(0),
    status: text("status", { enum: ["open", "closed", "archived"] }).notNull().default("open"),
    createdAt: isoTimestamp("created_at"),
    updatedAt: isoTimestamp("updated_at"),
  },
  (table) => [
    index("budget_periods_user_idx").on(table.userId, table.periodStart),
    uniqueIndex("budget_periods_identity_unique").on(table.userId, table.recurrence, table.periodStart),
  ],
);

export const budgetAllocations = sqliteTable(
  "budget_allocations",
  {
    id: text("id").primaryKey(),
    periodId: text("period_id").notNull().references(() => budgetPeriods.id, { onDelete: "cascade" }),
    templateId: text("template_id").references(() => budgetTemplates.id, { onDelete: "set null" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "restrict" }),
    kind: text("kind", { enum: ["expense", "savings"] }).notNull().default("expense"),
    originalAmount: real("original_amount").notNull(),
    adjustedAmount: real("adjusted_amount").notNull(),
    rolloverAmount: real("rollover_amount").notNull().default(0),
    createdAt: isoTimestamp("created_at"),
    updatedAt: isoTimestamp("updated_at"),
  },
  (table) => [
    index("budget_allocations_period_idx").on(table.periodId),
    uniqueIndex("budget_allocations_category_unique").on(table.periodId, table.kind, table.categoryId).where(sql`${table.categoryId} IS NOT NULL`),
    uniqueIndex("budget_allocations_overall_unique").on(table.periodId, table.kind).where(sql`${table.categoryId} IS NULL`),
  ],
);

export const budgetCategoryBuckets = sqliteTable(
  "budget_category_buckets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
    bucket: text("bucket", { enum: ["needs", "wants"] }).notNull(),
    createdAt: isoTimestamp("created_at"),
    updatedAt: isoTimestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("budget_category_buckets_user_category_unique").on(table.userId, table.categoryId),
    index("budget_category_buckets_user_idx").on(table.userId),
  ],
);

export const budgetMoves = sqliteTable(
  "budget_moves",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    periodId: text("period_id").notNull().references(() => budgetPeriods.id, { onDelete: "cascade" }),
    fromAllocationId: text("from_allocation_id").notNull().references(() => budgetAllocations.id, { onDelete: "restrict" }),
    toAllocationId: text("to_allocation_id").notNull().references(() => budgetAllocations.id, { onDelete: "restrict" }),
    amount: real("amount").notNull(),
    reversalOfId: text("reversal_of_id"),
    reversedAt: optionalIsoTimestamp("reversed_at"),
    createdAt: isoTimestamp("created_at"),
  },
  (table) => [
    index("budget_moves_user_period_idx").on(table.userId, table.periodId, table.createdAt),
    index("budget_moves_reversal_idx").on(table.reversalOfId),
  ],
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
    title: text("title").notNull().default(""),
    notes: text("notes"),
    frequency: text("frequency", { enum: ["daily", "weekly", "monthly", "yearly"] }).notNull(),
    nextDueDate: text("next_due_date").notNull(),
    endDate: text("end_date"),
    approvalRequired: integer("approval_required", { mode: "boolean" }).notNull().default(true),
    transferToAccountId: text("transfer_to_account_id").references(() => accounts.id),
    savingsInstrumentId: text("savings_instrument_id").references(() => savingsInstruments.id),
    goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
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
    type: text("type", { enum: ["expense", "income", "savings", "transfer", "adjust_balance", "goal_spend"] }).notNull(),
    amount: real("amount").notNull(),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    splits: text("splits").notNull().default("[]"),
    title: text("title").notNull().default(""),
    merchantName: text("merchant_name"),
    notes: text("notes"),
    tags: text("tags").notNull().default("[]"),
    isRecurring: integer("is_recurring", { mode: "boolean" }).notNull().default(false),
    recurringTemplateId: text("recurring_template_id").references(() => recurringTemplates.id, { onDelete: "set null" }),
    receiptImageUrl: text("receipt_image_url"),
    goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
    savingsInstrumentId: text("savings_instrument_id").references(() => savingsInstruments.id, { onDelete: "set null" }),
    transferToAccountId: text("transfer_to_account_id").references(() => accounts.id),
    loanId: text("loan_id").references(() => loans.id, { onDelete: "set null" }),
    loanPaymentEventId: text("loan_payment_event_id").references(() => loanPaymentEvents.id, { onDelete: "set null" }),
    loanComponent: text("loan_component", { enum: ["disbursement", "principal", "interest", "fee"] }),
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

export const recurringOccurrences = sqliteTable(
  "recurring_occurrences",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    recurringTemplateId: text("recurring_template_id").notNull().references(() => recurringTemplates.id, { onDelete: "cascade" }),
    scheduledDate: text("scheduled_date").notNull(),
    status: text("status", { enum: ["pending", "posted", "skipped"] }).notNull().default("pending"),
    transactionId: text("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
    createdAt: isoTimestamp("created_at").notNull(),
    updatedAt: isoTimestamp("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("recurring_occurrences_template_date_unique").on(table.recurringTemplateId, table.scheduledDate),
    index("recurring_occurrences_user_status_idx").on(table.userId, table.status, table.scheduledDate),
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

export const dataImports = sqliteTable(
  "data_imports",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    sourceExportedAt: text("source_exported_at"),
    status: text("status", { enum: ["requested", "completed", "failed"] }).notNull().default("requested"),
    requestedAt: isoTimestamp("requested_at"),
    completedAt: optionalIsoTimestamp("completed_at"),
    bytes: integer("bytes"),
    itemCount: integer("item_count"),
  },
  (table) => [
    index("data_imports_user_idx").on(table.userId),
    index("data_imports_requested_at_idx").on(table.requestedAt),
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
  pendingRegistrations,
  webauthnCredentials,
  webauthnChallenges,
  webauthnUnlockGrants,
  storageUsage,
  storedObjects,
  refreshTokens,
  passwordResetTokens,
  notificationSettings,
  accounts,
  homeAlerts,
  reportDeliveries,
  reportCache,
  reportGenerationLimits,
  categories,
  budgetIncomeSources,
  userTags,
  savingsInstrumentTypes,
  savingsInstruments,
  goals,
  loans,
  loanRatePeriods,
  loanInstallments,
  loanPaymentEvents,
  spendingBudgets,
  budgetTemplates,
  budgetPeriods,
  budgetAllocations,
  budgetCategoryBuckets,
  budgetMoves,
  recurringTemplates,
  recurringOccurrences,
  transactions,
  transactionHistory,
  dataExports,
  dataImports,
  accountDeletionRequests,
};

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

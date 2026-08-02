# Budget Tracker — Schema (Pseudocode)

This document describes the data model for a PWA budget tracker app. Use it as context for generating code, migrations, or API types.

## Overview

The app tracks four transaction types — **income**, **expense**, **savings**, **transfer** — against user **accounts**, with support for **goals** (savings targets), **spending budgets** (spending caps), **savings instruments** (pension/SIP/FD/CIT/SSF/etc.), recurring transactions, offline-first sync, and authentication via password + OTP + WebAuthn (biometric).

---

## Types

```typescript
type UUID = string
type ISODate = string       // "YYYY-MM-DD"
type ISOTimestamp = string  // full timestamp
```

---

## Auth

```typescript
interface User {
  id: UUID
  name: string
  email: string
  phone?: string
  passwordHash: string          // bcrypt/argon2, never plaintext
  currency: string              // "USD", "INR", etc.
  emailVerifiedAt?: ISOTimestamp
  phoneVerifiedAt?: ISOTimestamp
  createdAt: ISOTimestamp
}

// OTP for login 2FA, signup verification, password reset, step-up auth
interface OtpCode {
  id: UUID
  userId: UUID
  codeHash: string               // hashed, never plaintext
  channel: "email" | "sms"
  purpose: "login" | "signup_verify" | "password_reset" | "step_up"
  expiresAt: ISOTimestamp        // short-lived, e.g. 10 minutes
  consumedAt?: ISOTimestamp      // prevents replay
  attemptCount: number           // lock out after N failed guesses
}

// WebAuthn / biometric (Face ID, Touch ID, fingerprint)
interface WebAuthnCredential {
  id: UUID
  userId: UUID
  credentialId: string           // base64url credential ID
  publicKey: string               // COSE public key, base64
  signCount: number              // replay-attack counter, must only increase
  deviceLabel?: string           // "iPhone 15"
  lastUsedAt?: ISOTimestamp
}

// Server-tracked refresh tokens (for revocation + theft detection)
interface RefreshToken {
  id: UUID
  userId: UUID
  tokenHash: string               // hashed, never store raw
  deviceLabel?: string
  parentTokenId?: UUID            // links rotation chain
  issuedAt: ISOTimestamp
  expiresAt: ISOTimestamp         // e.g. 30 days
  revokedAt?: ISOTimestamp
  revokedReason?: "logout" | "rotated" | "reuse_detected" | "admin"
}
```

**Auth flow:**
1. Signup: email/phone + password → OTP verification (email or SMS)
2. Login: password check → OTP as 2FA → issue access token (JWT, ~15 min) + refresh token (opaque, stored hashed, ~30 days)
3. After login, user can register a WebAuthn credential for biometric unlock
4. Day-to-day app opens: WebAuthn only, no password/OTP
5. Sensitive actions (change password, add device, large transaction) require a fresh OTP (`purpose: "step_up"`), even if already logged in
6. Refresh token rotation: every refresh issues a new token and revokes the old one (`revokedReason: "rotated"`), linked via `parentTokenId`. Reuse of a revoked token = treat as theft, revoke the entire chain (`revokedReason: "reuse_detected"`)
7. Offline PWA note: access tokens are self-verifiable (signed JWT), so the app can check local validity without a network call. Set a longer access-token validity window to tolerate offline sessions; refresh only when connectivity returns. Prefer a lenient policy — allow local writes to queue even with an expired token, reconciling on sync — over blocking offline transaction entry.

---

## Accounts

```typescript
interface Account {
  id: UUID
  userId: UUID
  name: string                  // "Primary Checking", "Cash Wallet"
  type: "checking" | "cash" | "credit_card" | "general"
  currentBalance: number         // maintained automatically via trigger, never set directly
  isDefault: boolean
  displayOrder: number           // sort order in account list/selector UI
  backgroundColor?: string       // hex code, e.g. "#4F46E5"
  icon?: string                  // icon identifier or emoji
  includeInTotalBalance: boolean // false = excluded from the headline total balance (e.g. a tracked-only card)
  allowNegativeBalance: boolean   // false = transactions may not take this account below zero
}
```

## Categories

```typescript
interface Category {
  id: UUID
  userId?: UUID                  // null = system default
  name: string
  type: "expense" | "income"
  icon?: string
  color?: string
}
```

## Savings Instruments

Instrument *types* are a lookup table (not a fixed enum) so regional products (CIT, SSF, PPF, NPS, 401k, ISA, etc.) don't require a schema change — seeded with defaults, user-extensible.

```typescript
interface SavingsInstrumentType {
  id: UUID
  userId?: UUID                  // null = system default (seeded)
  name: string                   // "Pension", "SIP", "Fixed Deposit", "CIT", "SSF", "Other"
  isDefault: boolean
}

interface SavingsInstrument {
  id: UUID
  userId: UUID
  typeId: UUID                   // references SavingsInstrumentType
  name: string                   // "Company Pension", "SIP - Mutual Fund"
  currentBalance: number
  interestRate?: number
  maturityDate?: ISODate
}
```

## Goals (savings targets)

```typescript
interface Goal {
  id: UUID
  userId: UUID
  name: string                   // "Headset"
  targetAmount: number
  allocatedAmount: number        // auto-updated when transactions link here
  status: "active" | "completed" | "archived"
  targetDate?: ISODate
}
```

## Spending Budgets (spending caps — distinct from Goals)

```typescript
interface SpendingBudget {
  id: UUID
  userId: UUID
  categoryId?: UUID              // null = overall budget across all categories
  name: string                   // "Food Budget"
  limitAmount: number
  period: "weekly" | "monthly" | "yearly"
}
```

## Recurring Templates

```typescript
interface RecurringTemplate {
  id: UUID
  userId: UUID
  accountId: UUID
  type: "expense" | "income" | "savings" | "transfer"
  amount: number
  categoryId?: UUID
  notes?: string
  frequency: "daily" | "weekly" | "monthly" | "yearly"
  nextDueDate: ISODate
  isActive: boolean
}
```

## Transactions (core record)

```typescript
interface Transaction {
  id: UUID
  userId: UUID
  accountId: UUID

  type: "expense" | "income" | "savings" | "transfer" | "adjust_balance"
  amount: number                 // positive for all types except adjust_balance (may be negative, a decrease)

  categoryId?: UUID
  notes?: string
  tags: string[]
  isRecurring: boolean
  recurringTemplateId?: UUID
  receiptImageUrl?: string

  // Typically only one of these is set:
  goalId?: UUID                       // contribution to a goal
  savingsInstrumentId?: UUID          // affects a savings instrument
  transferToAccountId?: UUID          // REQUIRED if type === "transfer"

  date: ISODate

  // Offline-first sync
  syncStatus: "synced" | "pending" | "failed"
  clientGeneratedId?: UUID            // set client-side when created offline, enables idempotent sync

  createdAt: ISOTimestamp
  updatedAt: ISOTimestamp
}

// Transaction History (audit trail)
interface TransactionHistoryEntry {
  id: UUID
  transactionId: UUID
  changedBy?: UUID
  changeType: "created" | "updated" | "deleted"
  oldValues?: Partial<Transaction>
  newValues?: Partial<Transaction>
  changedAt: ISOTimestamp
}
```

## Notification Settings

```typescript
interface NotificationSettings {
  userId: UUID
  goalMilestonesEnabled: boolean
  recurringDueEnabled: boolean
  recurringTransactionEnabled: boolean
  recurringTransactionTime: string       // local time, "HH:mm"
  recurringTransactionFrequency: "daily" | "weekly" | "monthly"
  lowBalanceEnabled: boolean
  lowBalanceThreshold?: number
  pushSubscription?: object      // raw Web Push subscription object
}
```

---

## Core Behavior (pseudocode)

### Applying a transaction to account balance

```
function onTransactionCreated(t: Transaction):
  switch t.type:
    case "income":
      account(t.accountId).balance += t.amount
    case "expense", "savings":
      account(t.accountId).balance -= t.amount
    case "transfer":
      account(t.accountId).balance -= t.amount
      account(t.transferToAccountId).balance += t.amount
    case "adjust_balance":
      // amount is signed: positive increases balance, negative decreases it
      account(t.accountId).balance += t.amount
      account(t.accountId).balance += t.amount

  if t.goalId:
    goal(t.goalId).allocatedAmount += t.amount
    if goal(t.goalId).allocatedAmount >= goal(t.goalId).targetAmount:
      goal(t.goalId).status = "completed"

  logHistory(t, "created")
```

### Reversing a transaction on edit/delete

```
function onTransactionUpdatedOrDeleted(oldT: Transaction, newT?: Transaction):
  reverseBalanceEffect(oldT)
  if newT: applyBalanceEffect(newT)
  logHistory(oldT, newT ? "updated" : "deleted")
```

### Recurring template → transaction generation (scheduled job)

```
function runRecurringJob():
  for template in getActiveRecurringTemplatesDueToday():
    createTransaction({
      ...template,
      isRecurring: true,
      recurringTemplateId: template.id,
      date: today(),
    })
    template.nextDueDate = computeNextDueDate(template.frequency, template.nextDueDate)
```

### Offline sync

```
function syncPendingTransactions(localQueue: Transaction[]):
  for t in localQueue:
    upsertTransactionByClientId(t)   // clientGeneratedId makes this idempotent, safe to retry
    t.syncStatus = "synced"
```

---

## Derived / App-Layer Calculations

- **Net worth** = `sum(accounts.currentBalance) + sum(savingsInstruments.currentBalance)`
- **Remaining on a SpendingBudget** = `limitAmount - sum(expenses in categoryId for current period)`
- **Goal allocation vs balance**: currently modeled as a real balance deduction (a `savings`-type transaction with `goalId` set). If "earmarked but still spendable" money is needed instead, that requires a separate reserved/committed balance concept, not a real deduction — flag if this is wanted.

---

## Open Decisions / Notes for Implementation

- Multi-currency: schema assumes one currency per user (`User.currency`). Add a `currency` field to `Account` and an `ExchangeRate` type if multi-currency accounts are needed later.
- `Account.icon`: currently free-text (pick from a fixed frontend icon set, e.g. `lucide-react` icon names). Could become a lookup table like `SavingsInstrumentType` if regional/custom icon sets are ever needed — not expected for accounts.
- `adjust_balance` transactions: used to directly correct an account's balance (e.g. reconciling against a real bank balance) without it being income/expense/savings. `amount` is signed (positive or negative) for this type only — every other type keeps `amount > 0`. These should probably be visually distinguished in the transaction list (e.g. "Balance adjustment" label) and likely excluded from income/expense analytics charts, since they're corrections, not real cash flow.
- `Account.includeInTotalBalance`: lets a user exclude an account (e.g. a credit card they only track, not spend from) from the headline total balance shown on the dashboard, without hiding the account entirely.
- `Account.allowNegativeBalance`: defaults to false. Account opening balances and transaction effects are rejected when they would leave the account below zero unless this is enabled.
- Auth library candidates evaluated: Better Auth (lighter, but refresh-token rotation not first-class) vs SuperTokens (native refresh-token rotation + theft detection, but requires running a separate core service). Leaning SuperTokens for the token-rotation requirement.

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const userId = randomUUID();
const cashAccountId = randomUUID();
const loanAccountId = randomUUID();
const categoryId = randomUUID();
const loanId = randomUUID();
const installmentId = randomUUID();
const rateId = randomUUID();
const paymentId = randomUUID();
const transactionId = randomUUID();
const periodId = randomUUID();
const templateId = randomUUID();
const allocationId = randomUUID();
const secondAllocationId = randomUUID();
const bucketId = randomUUID();
const moveId = randomUUID();
const spendingBudgetId = randomUUID();
const now = "2026-08-12T00:00:00.000Z";

function sql(strings, ...values) {
  return strings.raw.reduce((result, part, index) => `${result}${part}${values[index] ?? ""}`, "");
}

function run(command) {
  const output = execFileSync("npx", ["wrangler", "d1", "execute", "luna", "--local", "--command", command, "--json"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(output);
}

function expectFailure(action, label) {
  try {
    action();
  } catch {
    return;
  }
  throw new Error(`${label}: expected the statement to fail`);
}

function assertZero(result, label) {
  const remaining = Number(result?.[0]?.results?.[0]?.remaining ?? -1);
  if (remaining !== 0) throw new Error(`${label}: expected zero remaining rows, received ${remaining}`);
}

const fixture = sql`
PRAGMA foreign_keys = ON;
INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES ('${userId}', 'Deletion Fixture', '${userId}@example.test', 'fixture', '${now}', '${now}');
INSERT INTO accounts (id, user_id, name, type, currency, opening_balance, current_balance) VALUES
  ('${cashAccountId}', '${userId}', 'Cash', 'cash', 'NPR', 0, 1000),
  ('${loanAccountId}', '${userId}', 'Loan', 'loan', 'NPR', 0, 5000);
INSERT INTO categories (id, user_id, name, type) VALUES ('${categoryId}', '${userId}', 'Food', 'expense');
INSERT INTO loans (id, user_id, account_id, name, direction, currency, original_principal, start_date, created_at, updated_at) VALUES ('${loanId}', '${userId}', '${loanAccountId}', 'Fixture loan', 'borrowed', 'NPR', 5000, '2026-08-01', '${now}', '${now}');
INSERT INTO loan_installments (id, loan_id, sequence, due_date) VALUES ('${installmentId}', '${loanId}', 1, '2026-09-01');
INSERT INTO loan_rate_periods (id, loan_id, annual_rate, effective_date, created_at) VALUES ('${rateId}', '${loanId}', 0, '2026-08-01', '${now}');
INSERT INTO loan_payment_events (id, user_id, loan_id, account_id, installment_id, kind, date, created_at) VALUES ('${paymentId}', '${userId}', '${loanId}', '${loanAccountId}', '${installmentId}', 'payment', '2026-08-12', '${now}');
INSERT INTO transactions (id, user_id, account_id, type, amount, category_id, title, date, transaction_at, created_at, updated_at, loan_id, loan_payment_event_id, loan_component) VALUES ('${transactionId}', '${userId}', '${cashAccountId}', 'expense', 100, '${categoryId}', 'Fixture transaction', '2026-08-12', '${now}', '${now}', '${now}', '${loanId}', '${paymentId}', 'principal');
INSERT INTO transaction_history (id, transaction_id, changed_by, change_type, changed_at) VALUES ('${randomUUID()}', '${transactionId}', '${userId}', 'created', '${now}');
INSERT INTO budget_periods (id, user_id, recurrence, period_start, period_end, created_at, updated_at) VALUES ('${periodId}', '${userId}', 'monthly', '2026-08-01', '2026-08-31', '${now}', '${now}');
INSERT INTO budget_templates (id, user_id, category_id, name, recurrence, default_amount, created_at, updated_at) VALUES ('${templateId}', '${userId}', '${categoryId}', 'Food plan', 'monthly', 1000, '${now}', '${now}');
INSERT INTO budget_allocations (id, period_id, template_id, category_id, original_amount, adjusted_amount, created_at, updated_at) VALUES
  ('${allocationId}', '${periodId}', '${templateId}', '${categoryId}', 1000, 1000, '${now}', '${now}'),
  ('${secondAllocationId}', '${periodId}', NULL, NULL, 4000, 4000, '${now}', '${now}');
INSERT INTO budget_category_buckets (id, user_id, category_id, bucket, created_at, updated_at) VALUES ('${bucketId}', '${userId}', '${categoryId}', 'needs', '${now}', '${now}');
INSERT INTO budget_moves (id, user_id, period_id, from_allocation_id, to_allocation_id, amount, created_at) VALUES ('${moveId}', '${userId}', '${periodId}', '${allocationId}', '${secondAllocationId}', 100, '${now}');
INSERT INTO spending_budgets (id, user_id, category_id, name, limit_amount, period, created_at, updated_at) VALUES ('${spendingBudgetId}', '${userId}', '${categoryId}', 'Food cap', 1000, 'monthly', '${now}', '${now}');
`;

const cleanup = sql`
PRAGMA foreign_keys = ON;
DELETE FROM transaction_history WHERE changed_by = '${userId}';
DELETE FROM transactions WHERE user_id = '${userId}';
DELETE FROM loan_payment_events WHERE user_id = '${userId}';
DELETE FROM loan_installments WHERE loan_id IN (SELECT id FROM loans WHERE user_id = '${userId}');
DELETE FROM loan_rate_periods WHERE loan_id IN (SELECT id FROM loans WHERE user_id = '${userId}');
DELETE FROM loans WHERE user_id = '${userId}';
DELETE FROM budget_moves WHERE user_id = '${userId}';
DELETE FROM budget_allocations WHERE period_id IN (SELECT id FROM budget_periods WHERE user_id = '${userId}');
DELETE FROM budget_category_buckets WHERE user_id = '${userId}';
DELETE FROM budget_periods WHERE user_id = '${userId}';
DELETE FROM budget_templates WHERE user_id = '${userId}';
DELETE FROM spending_budgets WHERE user_id = '${userId}';
DELETE FROM categories WHERE user_id = '${userId}';
DELETE FROM accounts WHERE user_id = '${userId}';
DELETE FROM users WHERE id = '${userId}';
`;

try {
  execFileSync("npx", ["wrangler", "d1", "migrations", "apply", "luna", "--local"], {
    cwd: new URL("..", import.meta.url),
    stdio: "ignore",
  });
  run(fixture);
  expectFailure(() => run(`PRAGMA foreign_keys = ON; DELETE FROM accounts WHERE id = '${loanAccountId}';`), "restrictive loan account FK");
  run(cleanup);
  const remaining = run(sql`
    SELECT
      (SELECT count(*) FROM users WHERE id = '${userId}') +
      (SELECT count(*) FROM accounts WHERE user_id = '${userId}') +
      (SELECT count(*) FROM loans WHERE user_id = '${userId}') +
      (SELECT count(*) FROM transactions WHERE user_id = '${userId}') +
      (SELECT count(*) FROM budget_periods WHERE user_id = '${userId}') +
      (SELECT count(*) FROM budget_allocations WHERE id IN ('${allocationId}', '${secondAllocationId}')) AS remaining;
  `);
  assertZero(remaining, "D1 deletion fixture");
  console.log("D1 account deletion integration test passed: loans, budgets, transactions, and restrictive FKs cleaned up");
} catch (error) {
  try { run(cleanup); } catch { /* preserve the original assertion or SQL error */ }
  throw error;
}

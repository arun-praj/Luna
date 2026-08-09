import { addMoney, normalizeMoney } from "@/lib/money";
import { z } from "zod";

export const moneyInput = z.number().finite().transform(normalizeMoney);
const nonNegativeMoneyInput = z.number().finite().nonnegative().transform(normalizeMoney);
export const positiveMoneyInput = z.number().finite().positive().transform(normalizeMoney);

export const accountType = z.enum(["checking", "cash", "credit_card", "general", "savings", "investment", "loan", "other"]);
export const transactionType = z.enum(["expense", "income", "savings", "transfer", "adjust_balance", "goal_spend"]);
export const recurringType = z.enum(["expense", "income", "savings", "transfer"]);

export const accountInput = z.object({
  name: z.string().trim().min(1).max(100),
  type: accountType,
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  openingBalance: moneyInput.optional(),
  isDefault: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
  icon: z.string().trim().max(2000).nullable().optional(),
  includeInTotalBalance: z.boolean().optional(),
  allowNegativeBalance: z.boolean().optional(),
});

export const categoryInput = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(["expense", "income"]),
  icon: z.string().trim().max(100).nullable().optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
});

export const tagInput = z.object({
  name: z.string().trim().min(1).max(50),
});

export const instrumentTypeInput = z.object({ name: z.string().trim().min(1).max(100) });

export const savingsInstrumentInput = z.object({
  typeId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  currentBalance: nonNegativeMoneyInput.optional(),
  interestRate: z.number().finite().nonnegative().nullable().optional(),
  icon: z.string().trim().max(200).optional(),
  backgroundColor: z.string().trim().regex(/^#[0-9a-f]{6}$/i).optional(),
  maturityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const goalInput = z.object({
  name: z.string().trim().min(1).max(100),
  targetAmount: positiveMoneyInput,
  monthlyContribution: nonNegativeMoneyInput.optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
});

export const goalCreateInput = goalInput.extend({ accountId: z.string().uuid() });

export const budgetInput = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(100).optional(),
  limitAmount: positiveMoneyInput,
  period: z.enum(["weekly", "monthly", "yearly"]),
  clientGeneratedId: z.string().uuid().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const recurringTemplateInput = z.object({
  accountId: z.string().uuid(),
  type: recurringType,
  amount: positiveMoneyInput,
  categoryId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  approvalRequired: z.boolean().optional(),
  transferToAccountId: z.string().uuid().nullable().optional(),
  savingsInstrumentId: z.string().uuid().nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const transactionSplitInput = z.object({
  categoryId: z.string().uuid(),
  amount: z.number().finite().positive(),
  note: z.string().trim().max(200).nullable().optional(),
});

export const transactionInput = z.object({
  accountId: z.string().uuid(),
  type: transactionType,
  amount: moneyInput,
  categoryId: z.string().uuid().nullable().optional(),
  splits: z.array(transactionSplitInput).min(2).max(20).optional(),
  title: z.string().trim().min(1).max(200),
  merchantName: z.string().trim().min(1).max(120).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  isRecurring: z.boolean().optional(),
  recurringTemplateId: z.string().uuid().nullable().optional(),
  receiptImageUrl: z.string().url().max(2000).nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
  savingsInstrumentId: z.string().uuid().nullable().optional(),
  transferToAccountId: z.string().uuid().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  transactionAt: z.string().datetime({ offset: true }).optional(),
  clientGeneratedId: z.string().uuid().optional(),
}).superRefine((value, context) => {
  if (!value.splits?.length) return;
  if (value.type !== "expense" && value.type !== "income") {
    context.addIssue({ code: "custom", path: ["splits"], message: "Only expenses and income can be split" });
  }
  const total = Math.round(value.splits.reduce((sum, split) => sum + split.amount, 0) * 100) / 100;
  const amount = Math.round(Math.abs(value.amount) * 100) / 100;
  if (total !== amount) {
    context.addIssue({ code: "custom", path: ["splits"], message: "Split amounts must equal the transaction amount" });
  }
  if (new Set(value.splits.map((split) => split.categoryId)).size !== value.splits.length) {
    context.addIssue({ code: "custom", path: ["splits"], message: "Each split category can only be used once" });
  }
});

export const accountOrderInput = z.object({
  accountIds: z.array(z.string().uuid()).min(1).max(100),
});

export const loanInput = z.object({
  name: z.string().trim().min(1).max(100),
  counterparty: z.string().trim().max(120).nullable().optional(),
  direction: z.enum(["borrowed", "lent"]),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  principal: positiveMoneyInput,
  setupMode: z.enum(["existing", "new"]),
  cashAccountId: z.string().uuid().nullable().optional(),
  interestMethod: z.enum(["none", "reducing", "flat"]).default("none"),
  annualRate: z.number().finite().min(0).max(100).nullable().optional(),
  paymentFrequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]).nullable().optional(),
  scheduledPayment: positiveMoneyInput.nullable().optional(),
  termCount: z.number().int().positive().max(600).nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  clientGeneratedId: z.string().uuid().optional(),
}).superRefine((value, context) => {
  if (value.setupMode === "new" && !value.cashAccountId) context.addIssue({ code: "custom", path: ["cashAccountId"], message: "Choose where the loan money moves" });
  if (value.interestMethod !== "none" && value.annualRate == null) context.addIssue({ code: "custom", path: ["annualRate"], message: "Add an annual rate" });
  if (value.firstDueDate && (!value.paymentFrequency || !value.termCount)) context.addIssue({ code: "custom", path: ["firstDueDate"], message: "Add frequency and number of payments" });
});

export const loanUpdateInput = z.object({
  name: z.string().trim().min(1).max(100),
  counterparty: z.string().trim().max(120).nullable(),
  interestMethod: z.enum(["none", "reducing", "flat"]),
  annualRate: z.number().finite().min(0).max(100).nullable(),
  paymentFrequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]).nullable(),
  scheduledPayment: positiveMoneyInput.nullable(),
  termCount: z.number().int().positive().max(600).nullable(),
  firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  notes: z.string().trim().max(1000).nullable(),
}).partial();
export const loanRateInput = z.object({ annualRate: z.number().finite().min(0).max(100), effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
export const loanPaymentInput = z.object({
  accountId: z.string().uuid(),
  principal: nonNegativeMoneyInput,
  interest: nonNegativeMoneyInput,
  fees: nonNegativeMoneyInput,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  installmentId: z.string().uuid().nullable().optional(),
  clientGeneratedId: z.string().uuid().optional(),
}).refine((value) => addMoney(addMoney(value.principal, value.interest), value.fees) > 0, { message: "Payment must be greater than zero" });
export const loanPaymentUpdateInput = z.object({
  principal: nonNegativeMoneyInput,
  interest: nonNegativeMoneyInput,
  fees: nonNegativeMoneyInput,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((value) => addMoney(addMoney(value.principal, value.interest), value.fees) > 0, { message: "Payment must be greater than zero" });

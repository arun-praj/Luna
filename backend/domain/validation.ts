import { z } from "zod";

export const accountType = z.enum(["checking", "cash", "credit_card", "general", "savings", "investment", "loan", "other"]);
export const transactionType = z.enum(["expense", "income", "savings", "transfer", "adjust_balance"]);
export const recurringType = z.enum(["expense", "income", "savings", "transfer"]);

export const accountInput = z.object({
  name: z.string().trim().min(1).max(100),
  type: accountType,
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  openingBalance: z.number().finite().optional(),
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
  currentBalance: z.number().finite().nonnegative().optional(),
  interestRate: z.number().finite().nonnegative().nullable().optional(),
  icon: z.string().trim().max(200).optional(),
  backgroundColor: z.string().trim().regex(/^#[0-9a-f]{6}$/i).optional(),
  maturityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const goalInput = z.object({
  name: z.string().trim().min(1).max(100),
  targetAmount: z.number().finite().positive(),
  status: z.enum(["active", "completed", "archived"]).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const budgetInput = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(100),
  limitAmount: z.number().finite().positive(),
  period: z.enum(["weekly", "monthly", "yearly"]),
});

export const recurringTemplateInput = z.object({
  accountId: z.string().uuid(),
  type: recurringType,
  amount: z.number().finite().positive(),
  categoryId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isActive: z.boolean().optional(),
});

export const transactionInput = z.object({
  accountId: z.string().uuid(),
  type: transactionType,
  amount: z.number().finite(),
  categoryId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(200),
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
});

export const accountOrderInput = z.object({
  accountIds: z.array(z.string().uuid()).min(1).max(100),
});

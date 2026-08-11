import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { accounts, loanInstallments, loanPaymentEvents, loanRatePeriods, loans, transactions } from "@/backend/db/schema";
import type { z } from "zod";
import { loanInput, loanPaymentInput, loanPaymentUpdateInput } from "@/backend/domain/validation";
import { addMoney, normalizeMoney, subtractMoney } from "@/lib/money";

type LoanInput = z.infer<typeof loanInput>;
type LoanPaymentInput = z.infer<typeof loanPaymentInput>;
type LoanPaymentUpdateInput = z.infer<typeof loanPaymentUpdateInput>;
type BatchStatement = Parameters<typeof db.batch>[0][number];

function executeBatch(statements: BatchStatement[]) {
  if (!statements.length) return Promise.resolve([]);
  return db.batch(statements as [BatchStatement, ...BatchStatement[]]);
}

const periodsPerYear = { weekly: 52, monthly: 12, quarterly: 4, yearly: 1 } as const;

function addPeriod(date: string, frequency: keyof typeof periodsPerYear, count: number) {
  const value = new Date(`${date}T12:00:00Z`);
  if (frequency === "weekly") value.setUTCDate(value.getUTCDate() + count * 7);
  if (frequency === "monthly") value.setUTCMonth(value.getUTCMonth() + count);
  if (frequency === "quarterly") value.setUTCMonth(value.getUTCMonth() + count * 3);
  if (frequency === "yearly") value.setUTCFullYear(value.getUTCFullYear() + count);
  return value.toISOString().slice(0, 10);
}

export function buildLoanSchedule(input: { principal: number; annualRate: number; method: "none" | "reducing" | "flat"; frequency: keyof typeof periodsPerYear; termCount: number; firstDueDate: string; scheduledPayment?: number | null }) {
  const rate = input.annualRate / 100 / periodsPerYear[input.frequency];
  const flatInterest = normalizeMoney(input.principal * (input.annualRate / 100) * (input.termCount / periodsPerYear[input.frequency]));
  const calculatedPayment = input.method === "reducing" && rate > 0
    ? input.principal * (rate * (1 + rate) ** input.termCount) / ((1 + rate) ** input.termCount - 1)
    : input.method === "flat" ? (input.principal + flatInterest) / input.termCount : input.principal / input.termCount;
  const payment = normalizeMoney(input.scheduledPayment ?? calculatedPayment);
  let remaining = input.principal;
  return Array.from({ length: input.termCount }, (_, index) => {
    const interest = input.method === "reducing" ? normalizeMoney(remaining * rate) : input.method === "flat" ? normalizeMoney(flatInterest / input.termCount) : 0;
    const principal = index === input.termCount - 1 ? remaining : Math.min(remaining, normalizeMoney(Math.max(0, payment - interest)));
    remaining = Math.max(0, subtractMoney(remaining, principal));
    return { id: randomUUID(), sequence: index + 1, dueDate: addPeriod(input.firstDueDate, input.frequency, index), expectedPrincipal: principal, expectedInterest: interest };
  });
}

export async function listLoans(userId: string) {
  const rows = await db.select({ loan: loans, balance: accounts.currentBalance }).from(loans).innerJoin(accounts, eq(loans.accountId, accounts.id)).where(eq(loans.userId, userId)).orderBy(asc(loans.status), asc(loans.nextDueDate), asc(loans.name));
  return rows.map(({ loan, balance }) => ({ ...loan, originalPrincipal: normalizeMoney(loan.originalPrincipal), outstandingPrincipal: Math.abs(normalizeMoney(balance)) }));
}

export async function getLoan(userId: string, id: string) {
  const [row] = await db.select({ loan: loans, balance: accounts.currentBalance }).from(loans).innerJoin(accounts, eq(loans.accountId, accounts.id)).where(and(eq(loans.id, id), eq(loans.userId, userId))).limit(1);
  if (!row) return null;
  const [rates, installments, payments] = await Promise.all([
    db.select().from(loanRatePeriods).where(eq(loanRatePeriods.loanId, id)).orderBy(asc(loanRatePeriods.effectiveDate)),
    db.select().from(loanInstallments).where(eq(loanInstallments.loanId, id)).orderBy(asc(loanInstallments.sequence)),
    db.select().from(loanPaymentEvents).where(eq(loanPaymentEvents.loanId, id)).orderBy(sql`${loanPaymentEvents.date} desc`),
  ]);
  return { ...row.loan, originalPrincipal: normalizeMoney(row.loan.originalPrincipal), outstandingPrincipal: Math.abs(normalizeMoney(row.balance)), rates, installments, payments };
}

export async function createLoan(userId: string, input: LoanInput) {
  const now = new Date().toISOString(); const loanId = randomUUID(); const accountId = randomUUID();
  let cashAccount: typeof accounts.$inferSelect | undefined;
  if (input.cashAccountId) [cashAccount] = await db.select().from(accounts).where(and(eq(accounts.id, input.cashAccountId), eq(accounts.userId, userId))).limit(1);
  if (input.setupMode === "new" && (!cashAccount || cashAccount.currency !== input.currency || cashAccount.type === "loan")) throw new Error("Choose a non-loan account in the same currency");
  if (cashAccount && input.direction === "lent" && !cashAccount.allowNegativeBalance && cashAccount.currentBalance < input.principal) throw new Error(`${cashAccount.name} cannot go below zero`);
  const signedBalance = input.direction === "borrowed" ? -input.principal : input.principal;
  const statements: BatchStatement[] = [
    db.insert(accounts).values({ id: accountId, userId, name: input.name, type: "loan", currency: input.currency, openingBalance: signedBalance, currentBalance: signedBalance, includeInTotalBalance: false, allowNegativeBalance: input.direction === "borrowed", icon: "Loan", backgroundColor: "#e6eef6" }),
    db.insert(loans).values({ id: loanId, userId, accountId, name: input.name, counterparty: input.counterparty ?? null, direction: input.direction, currency: input.currency, originalPrincipal: input.principal, interestMethod: input.interestMethod, paymentFrequency: input.paymentFrequency ?? null, scheduledPayment: input.scheduledPayment ?? null, termCount: input.termCount ?? null, startDate: input.startDate, firstDueDate: input.firstDueDate ?? null, nextDueDate: input.firstDueDate ?? null, notes: input.notes ?? null, createdAt: now, updatedAt: now }),
  ];
  if (input.annualRate != null) statements.push(db.insert(loanRatePeriods).values({ id: randomUUID(), loanId, annualRate: input.annualRate, effectiveDate: input.startDate, createdAt: now }));
  if (input.firstDueDate && input.paymentFrequency && input.termCount) {
    const schedule = buildLoanSchedule({ principal: input.principal, annualRate: input.annualRate ?? 0, method: input.interestMethod, frequency: input.paymentFrequency, termCount: input.termCount, firstDueDate: input.firstDueDate, scheduledPayment: input.scheduledPayment });
    for (const item of schedule) statements.push(db.insert(loanInstallments).values({ ...item, loanId }));
  }
  if (input.setupMode === "new" && cashAccount) {
    const eventId = randomUUID(); const transactionId = randomUUID();
    statements.push(db.insert(loanPaymentEvents).values({ id: eventId, userId, loanId, accountId: cashAccount.id, kind: "disbursement", principal: input.principal, date: input.startDate, clientGeneratedId: input.clientGeneratedId ?? null, createdAt: now }));
    statements.push(db.update(accounts).set({ currentBalance: sql`round(${accounts.currentBalance} + ${input.direction === "borrowed" ? input.principal : -input.principal}, 2)` }).where(eq(accounts.id, cashAccount.id)));
    statements.push(db.insert(transactions).values({ id: transactionId, userId, accountId: input.direction === "borrowed" ? accountId : cashAccount.id, transferToAccountId: input.direction === "borrowed" ? cashAccount.id : accountId, type: "transfer", amount: input.principal, title: `${input.name} disbursement`, loanId, loanPaymentEventId: eventId, loanComponent: "disbursement", date: input.startDate, transactionAt: `${input.startDate}T12:00:00.000Z`, createdAt: now, updatedAt: now }));
  }
  await executeBatch(statements);
  return getLoan(userId, loanId);
}

export async function deleteLoan(userId: string, loanId: string) {
  const detail = await getLoan(userId, loanId);
  if (!detail) throw new Error("Loan not found");
  const events = await db.select().from(loanPaymentEvents).where(and(eq(loanPaymentEvents.loanId, loanId), eq(loanPaymentEvents.userId, userId)));
  if (events.some((event) => event.kind === "payment" || event.kind === "reversal")) {
    throw new Error("Loans with recorded payments cannot be deleted");
  }

  const disbursement = events.find((event) => event.kind === "disbursement");
  const statements: BatchStatement[] = [];
  if (disbursement && disbursement.principal > 0) {
    const cashDelta = detail.direction === "borrowed" ? -disbursement.principal : disbursement.principal;
    statements.push(db.update(accounts).set({ currentBalance: sql`round(${accounts.currentBalance} + ${cashDelta}, 2)` }).where(and(eq(accounts.id, disbursement.accountId), eq(accounts.userId, userId))));
  }
  statements.push(db.delete(transactions).where(and(eq(transactions.loanId, loanId), eq(transactions.userId, userId))));
  statements.push(db.delete(loanPaymentEvents).where(and(eq(loanPaymentEvents.loanId, loanId), eq(loanPaymentEvents.userId, userId))));
  statements.push(db.delete(loanInstallments).where(eq(loanInstallments.loanId, loanId)));
  statements.push(db.delete(loanRatePeriods).where(eq(loanRatePeriods.loanId, loanId)));
  statements.push(db.delete(loans).where(and(eq(loans.id, loanId), eq(loans.userId, userId))));
  statements.push(db.delete(accounts).where(and(eq(accounts.id, detail.accountId), eq(accounts.userId, userId), eq(accounts.type, "loan"))));
  await executeBatch(statements);
  return { deleted: true };
}

export async function recordLoanPayment(userId: string, loanId: string, input: LoanPaymentInput) {
  if (input.clientGeneratedId) {
    const [existing] = await db.select({ loanId: loanPaymentEvents.loanId }).from(loanPaymentEvents).where(and(eq(loanPaymentEvents.userId, userId), eq(loanPaymentEvents.clientGeneratedId, input.clientGeneratedId))).limit(1);
    if (existing) {
      if (existing.loanId !== loanId) throw new Error("Payment reference belongs to another loan");
      return getLoan(userId, loanId);
    }
  }
  const detail = await getLoan(userId, loanId); if (!detail) throw new Error("Loan not found");
  if (detail.status !== "active") throw new Error("Only active loans can receive payments");
  const [cash] = await db.select().from(accounts).where(and(eq(accounts.id, input.accountId), eq(accounts.userId, userId))).limit(1);
  if (!cash || cash.type === "loan" || cash.currency !== detail.currency) throw new Error("Choose a non-loan account in the same currency");
  if (input.principal > detail.outstandingPrincipal) throw new Error("Principal cannot exceed the outstanding balance");
  const totalOut = addMoney(addMoney(input.principal, input.interest), input.fees);
  if (detail.direction === "borrowed" && !cash.allowNegativeBalance && cash.currentBalance < totalOut) throw new Error(`${cash.name} cannot go below zero`);
  const now = new Date().toISOString(); const eventId = randomUUID(); const statements: BatchStatement[] = [];
  statements.push(db.insert(loanPaymentEvents).values({ id: eventId, userId, loanId, accountId: cash.id, installmentId: input.installmentId ?? null, kind: "payment", principal: input.principal, interest: input.interest, fees: input.fees, date: input.date, clientGeneratedId: input.clientGeneratedId ?? null, createdAt: now }));
  if (input.principal > 0) {
    const sourceId = detail.direction === "borrowed" ? cash.id : detail.accountId; const targetId = detail.direction === "borrowed" ? detail.accountId : cash.id;
    statements.push(db.update(accounts).set({ currentBalance: sql`round(${accounts.currentBalance} - ${input.principal}, 2)` }).where(eq(accounts.id, sourceId)));
    statements.push(db.update(accounts).set({ currentBalance: sql`round(${accounts.currentBalance} + ${input.principal}, 2)` }).where(eq(accounts.id, targetId)));
    statements.push(db.insert(transactions).values({ id: randomUUID(), userId, accountId: sourceId, transferToAccountId: targetId, type: "transfer", amount: input.principal, title: `${detail.name} principal`, loanId, loanPaymentEventId: eventId, loanComponent: "principal", date: input.date, transactionAt: `${input.date}T12:00:00.000Z`, createdAt: now, updatedAt: now }));
  }
  for (const [component, amount] of [["interest", input.interest], ["fee", input.fees]] as const) if (amount > 0) statements.push(db.insert(transactions).values({ id: randomUUID(), userId, accountId: cash.id, type: detail.direction === "borrowed" ? "expense" : "income", amount, title: `${detail.name} ${component}`, loanId, loanPaymentEventId: eventId, loanComponent: component, date: input.date, transactionAt: `${input.date}T12:00:00.000Z`, createdAt: now, updatedAt: now }));
  if (detail.direction === "borrowed" && addMoney(input.interest, input.fees) > 0) statements.push(db.update(accounts).set({ currentBalance: sql`round(${accounts.currentBalance} - ${addMoney(input.interest, input.fees)}, 2)` }).where(eq(accounts.id, cash.id)));
  if (detail.direction === "lent" && addMoney(input.interest, input.fees) > 0) statements.push(db.update(accounts).set({ currentBalance: sql`round(${accounts.currentBalance} + ${addMoney(input.interest, input.fees)}, 2)` }).where(eq(accounts.id, cash.id)));
  const remaining = subtractMoney(detail.outstandingPrincipal, input.principal);
  if (remaining === 0) statements.push(db.update(loans).set({ status: "paid_off", nextDueDate: null, updatedAt: now }).where(eq(loans.id, loanId)));
  if (input.installmentId) {
    const installment = detail.installments.find((item) => item.id === input.installmentId);
    if (!installment) throw new Error("Installment not found");
    const paidPrincipal = addMoney(installment.paidPrincipal, input.principal); const paidInterest = addMoney(installment.paidInterest, input.interest); const paidFees = addMoney(installment.paidFees, input.fees);
    const paid = paidPrincipal >= installment.expectedPrincipal && paidInterest >= installment.expectedInterest && paidFees >= installment.expectedFees;
    statements.push(db.update(loanInstallments).set({ paidPrincipal, paidInterest, paidFees, status: paid ? "paid" : "partial" }).where(eq(loanInstallments.id, installment.id)));
    if (paid) { const next = detail.installments.find((item) => item.sequence > installment.sequence && item.status === "pending"); statements.push(db.update(loans).set({ nextDueDate: next?.dueDate ?? null, updatedAt: now }).where(eq(loans.id, loanId))); }
  }
  await executeBatch(statements);
  return getLoan(userId, loanId);
}

export async function updateLoanPayment(userId: string, loanId: string, paymentId: string, input: LoanPaymentUpdateInput) {
  const detail = await getLoan(userId, loanId);
  if (!detail) throw new Error("Loan not found");
  if (detail.status === "archived") throw new Error("Archived loans cannot be edited");
  const [event] = await db.select().from(loanPaymentEvents).where(and(eq(loanPaymentEvents.id, paymentId), eq(loanPaymentEvents.loanId, loanId), eq(loanPaymentEvents.userId, userId))).limit(1);
  if (!event || event.kind !== "payment") throw new Error("Payment not found");

  const oldTotal = addMoney(addMoney(event.principal, event.interest), event.fees);
  const newTotal = addMoney(addMoney(input.principal, input.interest), input.fees);
  const maximumPrincipal = addMoney(detail.outstandingPrincipal, event.principal);
  if (input.principal > maximumPrincipal) throw new Error("Principal cannot exceed the outstanding balance");
  const [cash] = await db.select().from(accounts).where(and(eq(accounts.id, event.accountId), eq(accounts.userId, userId))).limit(1);
  if (!cash || cash.type === "loan" || cash.currency !== detail.currency) throw new Error("Payment account is no longer available");
  if (detail.direction === "borrowed" && !cash.allowNegativeBalance && addMoney(cash.currentBalance, oldTotal) < newTotal) throw new Error(`${cash.name} cannot go below zero`);

  const now = new Date().toISOString();
  const statements: BatchStatement[] = [];
  const sourceId = detail.direction === "borrowed" ? event.accountId : detail.accountId;
  const targetId = detail.direction === "borrowed" ? detail.accountId : event.accountId;
  const cashDelta = detail.direction === "borrowed" ? subtractMoney(oldTotal, newTotal) : subtractMoney(newTotal, oldTotal);
  const loanDelta = detail.direction === "borrowed" ? subtractMoney(input.principal, event.principal) : subtractMoney(event.principal, input.principal);

  statements.push(db.update(loanPaymentEvents).set({ principal: input.principal, interest: input.interest, fees: input.fees, date: input.date }).where(eq(loanPaymentEvents.id, event.id)));
  if (cashDelta !== 0) statements.push(db.update(accounts).set({ currentBalance: sql`round(${accounts.currentBalance} + ${cashDelta}, 2)` }).where(eq(accounts.id, event.accountId)));
  if (loanDelta !== 0) statements.push(db.update(accounts).set({ currentBalance: sql`round(${accounts.currentBalance} + ${loanDelta}, 2)` }).where(eq(accounts.id, detail.accountId)));

  const relatedTransactions = await db.select().from(transactions).where(and(eq(transactions.loanPaymentEventId, event.id), eq(transactions.userId, userId)));
  const transactionByComponent = (component: "principal" | "interest" | "fee") => relatedTransactions.find((transaction) => transaction.loanComponent === component);
  const upsertComponent = (component: "principal" | "interest" | "fee", amount: number) => {
    const existing = transactionByComponent(component);
    if (component === "principal") {
      if (amount > 0 && existing) statements.push(db.update(transactions).set({ amount, date: input.date, transactionAt: `${input.date}T12:00:00.000Z`, updatedAt: now }).where(eq(transactions.id, existing.id)));
      else if (amount > 0) statements.push(db.insert(transactions).values({ id: randomUUID(), userId, accountId: sourceId, transferToAccountId: targetId, type: "transfer", amount, title: `${detail.name} principal`, loanId, loanPaymentEventId: event.id, loanComponent: "principal", date: input.date, transactionAt: `${input.date}T12:00:00.000Z`, createdAt: now, updatedAt: now }));
      else if (existing) statements.push(db.delete(transactions).where(eq(transactions.id, existing.id)));
      return;
    }
    const accountType = detail.direction === "borrowed" ? "expense" as const : "income" as const;
    if (amount > 0 && existing) statements.push(db.update(transactions).set({ amount, date: input.date, transactionAt: `${input.date}T12:00:00.000Z`, updatedAt: now }).where(eq(transactions.id, existing.id)));
    else if (amount > 0) statements.push(db.insert(transactions).values({ id: randomUUID(), userId, accountId: event.accountId, type: accountType, amount, title: `${detail.name} ${component}`, loanId, loanPaymentEventId: event.id, loanComponent: component, date: input.date, transactionAt: `${input.date}T12:00:00.000Z`, createdAt: now, updatedAt: now }));
    else if (existing) statements.push(db.delete(transactions).where(eq(transactions.id, existing.id)));
  };
  upsertComponent("principal", input.principal);
  upsertComponent("interest", input.interest);
  upsertComponent("fee", input.fees);

  const paymentEvents = await db.select().from(loanPaymentEvents).where(and(eq(loanPaymentEvents.loanId, loanId), eq(loanPaymentEvents.userId, userId)));
  const projectedEvents = paymentEvents.map((item) => item.id === event.id ? { ...item, principal: input.principal, interest: input.interest, fees: input.fees, date: input.date } : item);
  const nextInstallmentDates: Array<{ dueDate: string; status: "pending" | "partial" | "paid" }> = [];
  for (const installment of detail.installments) {
    const installmentPayments = projectedEvents.filter((item) => item.kind === "payment" && item.installmentId === installment.id);
    const paidPrincipal = installmentPayments.reduce((sum, item) => addMoney(sum, item.principal), 0);
    const paidInterest = installmentPayments.reduce((sum, item) => addMoney(sum, item.interest), 0);
    const paidFees = installmentPayments.reduce((sum, item) => addMoney(sum, item.fees), 0);
    const paid = paidPrincipal >= installment.expectedPrincipal && paidInterest >= installment.expectedInterest && paidFees >= installment.expectedFees;
    const status = paid ? "paid" : paidPrincipal > 0 || paidInterest > 0 || paidFees > 0 ? "partial" : "pending";
    nextInstallmentDates.push({ dueDate: installment.dueDate, status });
    statements.push(db.update(loanInstallments).set({ paidPrincipal, paidInterest, paidFees, status }).where(eq(loanInstallments.id, installment.id)));
  }
  const nextDueDate = detail.installments.length ? nextInstallmentDates.find((item) => item.status !== "paid")?.dueDate ?? null : detail.nextDueDate;
  const outstandingPrincipal = subtractMoney(detail.outstandingPrincipal, input.principal - event.principal);
  statements.push(db.update(loans).set({ status: outstandingPrincipal === 0 ? "paid_off" : "active", nextDueDate: outstandingPrincipal === 0 ? null : nextDueDate, updatedAt: now }).where(eq(loans.id, loanId)));
  await executeBatch(statements);
  return getLoan(userId, loanId);
}

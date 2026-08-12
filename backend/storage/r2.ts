import "server-only";

import { env } from "cloudflare:workers";
import { requireConfiguredStorage } from "@/backend/storage/r2-contract";
import { transactionReceiptKeyForUser } from "@/backend/storage/transaction-receipts";

export function r2Configured() {
  return Boolean(env.R2);
}

export function r2Bucket(): R2Bucket {
  return env.R2;
}

/** Privacy-sensitive workflows must fail closed when object storage is unavailable. */
export function requireR2Bucket(): R2Bucket {
  return requireConfiguredStorage(r2Configured() ? r2Bucket() : undefined);
}

/** Best-effort cleanup for an upload that was never committed to a transaction. */
export async function deleteTransactionReceipt(userId: string, reference: string | null | undefined) {
  const key = transactionReceiptKeyForUser(userId, reference);
  if (!key || !r2Configured()) return;
  try {
    await r2Bucket().delete(key);
  } catch (error) {
    console.error("Receipt cleanup failed", { userId, key, error });
  }
}

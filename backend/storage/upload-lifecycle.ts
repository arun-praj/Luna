import "server-only";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { accounts, savingsInstruments, transactions, users } from "@/backend/db/schema";
import { r2Bucket, r2Configured } from "@/backend/storage/r2";
import {
  assertUploadFitsQuota,
  MAX_UPLOAD_BYTES,
  ownedUploadKey,
  staleOrphanUploadKeys,
  type UploadKind,
  uploadKinds,
  uploadPrefix,
  UploadQuotaExceededError,
  USER_UPLOAD_QUOTA_BYTES,
} from "@/backend/storage/upload-policy";

export type UploadObject = {
  key: string;
  size: number;
  uploaded?: Date;
};

type UploadListPage = {
  objects: UploadObject[];
  truncated: boolean;
  cursor?: string;
};

const userUploadLocks = new Map<string, Promise<void>>();

async function withUserUploadLock<T>(userId: string, work: () => Promise<T>) {
  const previous = userUploadLocks.get(userId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  userUploadLocks.set(userId, current);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (userUploadLocks.get(userId) === current) userUploadLocks.delete(userId);
  }
}

function listPage(options: { prefix: string; cursor?: string }): Promise<UploadListPage> {
  return r2Bucket().list(options) as Promise<UploadListPage>;
}

export async function listUserUploadObjects(userId: string) {
  const objects: UploadObject[] = [];
  for (const kind of uploadKinds) {
    let cursor: string | undefined;
    do {
      const page = await listPage({ prefix: uploadPrefix(kind, userId), ...(cursor ? { cursor } : {}) });
      objects.push(...page.objects);
      cursor = page.truncated ? page.cursor : undefined;
      if (page.truncated && !cursor) throw new Error("R2 returned a truncated upload listing without a cursor");
    } while (cursor);
  }
  return objects;
}

export async function ensureUploadQuota(userId: string, incomingBytes: number) {
  const objects = await listUserUploadObjects(userId);
  const usedBytes = objects.reduce((total, object) => total + Math.max(0, Number(object.size) || 0), 0);
  assertUploadFitsQuota(usedBytes, incomingBytes);
  return { usedBytes, remainingBytes: Math.max(0, USER_UPLOAD_QUOTA_BYTES - usedBytes) };
}

export async function putUserUpload(options: {
  kind: UploadKind;
  userId: string;
  file: File;
  extension: string;
  cacheControl: string;
}) {
  return withUserUploadLock(options.userId, async () => {
    if (options.file.size > MAX_UPLOAD_BYTES) throw new RangeError("The upload must be smaller than 5 MB");
    await ensureUploadQuota(options.userId, options.file.size);
    const key = `${uploadPrefix(options.kind, options.userId)}${randomUUID()}.${options.extension}`;
    try {
      await r2Bucket().put(key, await options.file.arrayBuffer(), {
        httpMetadata: { contentType: options.file.type, cacheControl: options.cacheControl },
        customMetadata: { userId: options.userId, uploadKind: options.kind },
      });
      // The preflight list prevents ordinary over-quota writes. Recheck after
      // the put so requests reaching different Worker isolates still cannot
      // leave the user's prefix over quota when R2 is strongly consistent.
      const objects = await listUserUploadObjects(options.userId);
      const usedBytes = objects.reduce((total, object) => total + Math.max(0, Number(object.size) || 0), 0);
      if (usedBytes > USER_UPLOAD_QUOTA_BYTES) {
        await r2Bucket().delete(key).catch((cleanupError) => console.error("Over-quota upload cleanup failed", { userId: options.userId, key, cleanupError }));
        throw new UploadQuotaExceededError("Your upload storage limit is 50 MB. Remove an unused image or receipt before uploading another file.");
      }
      return key;
    } catch (error) {
      console.error("Upload write failed", { userId: options.userId, kind: options.kind, key, error });
      throw error;
    }
  });
}

export async function referencedUploadKeys(userId: string) {
  const [accountRows, savingsRows, transactionRows] = await Promise.all([
    db.select({ icon: accounts.icon }).from(accounts).where(eq(accounts.userId, userId)),
    db.select({ icon: savingsInstruments.icon }).from(savingsInstruments).where(eq(savingsInstruments.userId, userId)),
    db.select({ receiptImageUrl: transactions.receiptImageUrl }).from(transactions).where(eq(transactions.userId, userId)),
  ]);
  const references = new Set<string>();
  for (const row of accountRows) {
    const key = ownedUploadKey("account-images", userId, row.icon);
    if (key) references.add(key);
  }
  for (const row of savingsRows) {
    const key = ownedUploadKey("savings-images", userId, row.icon);
    if (key) references.add(key);
  }
  for (const row of transactionRows) {
    const key = ownedUploadKey("transaction-receipts", userId, row.receiptImageUrl);
    if (key) references.add(key);
  }
  return references;
}

export async function deleteUploadIfUnreferenced(userId: string, kind: UploadKind, reference: string | null | undefined) {
  const key = ownedUploadKey(kind, userId, reference);
  if (!key) return false;
  const references = await referencedUploadKeys(userId);
  if (references.has(key)) return false;
  await r2Bucket().delete(key);
  return true;
}

export async function sweepOrphanedUserUploads(userId: string, now = new Date()) {
  const references = await referencedUploadKeys(userId);
  const objects = await listUserUploadObjects(userId);
  const orphanKeys = staleOrphanUploadKeys(objects, references, now);
  if (orphanKeys.length > 0) await r2Bucket().delete(orphanKeys);
  return { scanned: objects.length, deleted: orphanKeys.length };
}

export async function runScheduledUploadMaintenance(now = new Date()) {
  // The Worker runs every minute. A fifteen-minute cadence keeps R2 listing
  // costs bounded while still repairing abandoned uploads promptly.
  if (!r2Configured() || now.getUTCMinutes() % 15 !== 0) return { skipped: true, users: 0, deleted: 0 };
  const userRows = await db.select({ id: users.id }).from(users);
  let deleted = 0;
  for (const user of userRows) deleted += (await sweepOrphanedUserUploads(user.id, now)).deleted;
  return { skipped: false, users: userRows.length, deleted };
}

export function isUploadQuotaError(error: unknown): error is UploadQuotaExceededError {
  return error instanceof UploadQuotaExceededError || (error instanceof Error && error.message.includes("upload storage limit is 50 MB"));
}

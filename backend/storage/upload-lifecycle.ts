import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { accounts, savingsInstruments, storedObjects, storageUsage, transactions, users } from "@/backend/db/schema";
import { r2Bucket, r2Configured } from "@/backend/storage/r2";
import { assertImageSignature, MAX_UPLOAD_BYTES, ownedUploadKey, ORPHAN_UPLOAD_GRACE_MS, type UploadKind, uploadKinds, uploadPrefix, UploadQuotaExceededError, USER_UPLOAD_QUOTA_BYTES } from "@/backend/storage/upload-policy";

export type UploadObject = { key: string; size: number; uploaded?: Date };
type UploadListPage = { objects: UploadObject[]; truncated: boolean; cursor?: string };

function listPage(options: { prefix: string; cursor?: string }): Promise<UploadListPage> { return r2Bucket().list(options) as Promise<UploadListPage>; }

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
  if (incomingBytes > MAX_UPLOAD_BYTES) throw new RangeError("The upload must be smaller than 5 MB");
  const [usage] = await db.select({ reservedBytes: storageUsage.reservedBytes }).from(storageUsage).where(eq(storageUsage.userId, userId)).limit(1);
  const usedBytes = Math.max(0, usage?.reservedBytes ?? 0);
  if (usedBytes + incomingBytes > USER_UPLOAD_QUOTA_BYTES) throw new UploadQuotaExceededError("Your upload storage limit is 50 MB. Remove an unused image or receipt before uploading another file.");
  return { usedBytes, remainingBytes: Math.max(0, USER_UPLOAD_QUOTA_BYTES - usedBytes) };
}

async function releaseReservedBytes(userId: string, bytes: number, now: string) {
  await db.update(storageUsage).set({ reservedBytes: sql`max(0, ${storageUsage.reservedBytes} - ${bytes})`, updatedAt: now }).where(eq(storageUsage.userId, userId));
}

async function reserveObject(userId: string, bytes: number, now: string) {
  await db.insert(storageUsage).values({ userId, reservedBytes: 0, updatedAt: now }).onConflictDoNothing();
  const [reserved] = await db.update(storageUsage).set({ reservedBytes: sql`${storageUsage.reservedBytes} + ${bytes}`, updatedAt: now }).where(and(eq(storageUsage.userId, userId), sql`${storageUsage.reservedBytes} + ${bytes} <= ${USER_UPLOAD_QUOTA_BYTES}`)).returning({ userId: storageUsage.userId });
  return Boolean(reserved);
}

export async function putUserUpload(options: { kind: UploadKind; userId: string; file: File; extension: string; cacheControl: string }) {
  if (options.file.size > MAX_UPLOAD_BYTES) throw new RangeError("The upload must be smaller than 5 MB");
  const bytes = new Uint8Array(await options.file.arrayBuffer());
  assertImageSignature(bytes, options.file.type);
  const timestamp = new Date().toISOString();
  const key = `${uploadPrefix(options.kind, options.userId)}${randomUUID()}.${options.extension}`;
  if (!(await reserveObject(options.userId, bytes.byteLength, timestamp))) throw new UploadQuotaExceededError("Your upload storage limit is 50 MB. Remove an unused image or receipt before uploading another file.");
  try {
    await db.insert(storedObjects).values({ id: randomUUID(), userId: options.userId, objectKey: key, kind: options.kind, byteSize: bytes.byteLength, contentType: options.file.type, checksum: createHash("sha256").update(bytes).digest("hex"), status: "reserved", entityType: null, entityId: null, reservedAt: timestamp, uploadedAt: null, deleteAfter: new Date(Date.now() + ORPHAN_UPLOAD_GRACE_MS).toISOString(), createdAt: timestamp, updatedAt: timestamp });
    await r2Bucket().put(key, bytes, { httpMetadata: { contentType: options.file.type, cacheControl: options.cacheControl }, customMetadata: { userId: options.userId, uploadKind: options.kind } });
    await db.update(storedObjects).set({ status: "uploaded", uploadedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(storedObjects.objectKey, key), eq(storedObjects.userId, options.userId), eq(storedObjects.status, "reserved")));
    return key;
  } catch (error) {
    await r2Bucket().delete(key).catch(() => undefined);
    await db.update(storedObjects).set({ status: "failed", updatedAt: new Date().toISOString() }).where(and(eq(storedObjects.objectKey, key), eq(storedObjects.userId, options.userId), inArray(storedObjects.status, ["reserved", "uploaded"])));
    await releaseReservedBytes(options.userId, bytes.byteLength, new Date().toISOString());
    throw error;
  }
}

export async function referencedUploadKeys(userId: string) {
  const [accountRows, savingsRows, transactionRows] = await Promise.all([
    db.select({ icon: accounts.icon }).from(accounts).where(eq(accounts.userId, userId)),
    db.select({ icon: savingsInstruments.icon }).from(savingsInstruments).where(eq(savingsInstruments.userId, userId)),
    db.select({ receiptImageUrl: transactions.receiptImageUrl }).from(transactions).where(eq(transactions.userId, userId)),
  ]);
  const references = new Set<string>();
  for (const row of accountRows) { const key = ownedUploadKey("account-images", userId, row.icon); if (key) references.add(key); }
  for (const row of savingsRows) { const key = ownedUploadKey("savings-images", userId, row.icon); if (key) references.add(key); }
  for (const row of transactionRows) { const key = ownedUploadKey("transaction-receipts", userId, row.receiptImageUrl); if (key) references.add(key); }
  return references;
}

export async function attachStoredObject(userId: string, kind: UploadKind, reference: string | null | undefined, entityType: string, entityId: string) {
  const key = ownedUploadKey(kind, userId, reference);
  if (!key) return false;
  const timestamp = new Date().toISOString();
  const [attached] = await db.update(storedObjects).set({ status: "attached", entityType, entityId, deleteAfter: null, updatedAt: timestamp }).where(and(eq(storedObjects.userId, userId), eq(storedObjects.objectKey, key), inArray(storedObjects.status, ["uploaded", "attached"]))).returning({ id: storedObjects.id });
  return Boolean(attached);
}

export async function deleteUploadIfUnreferenced(userId: string, kind: UploadKind, reference: string | null | undefined) {
  const key = ownedUploadKey(kind, userId, reference);
  if (!key) return false;
  const references = await referencedUploadKeys(userId);
  if (references.has(key)) return false;
  const [stored] = await db.select({ id: storedObjects.id, byteSize: storedObjects.byteSize, status: storedObjects.status }).from(storedObjects).where(and(eq(storedObjects.userId, userId), eq(storedObjects.objectKey, key))).limit(1);
  if (!stored) { await r2Bucket().delete(key); return true; }
  if (stored.status === "attached") return false;
  await r2Bucket().delete(key);
  const now = new Date().toISOString();
  const [deleted] = await db.update(storedObjects).set({ status: "deleted", deleteAfter: now, updatedAt: now }).where(and(eq(storedObjects.id, stored.id), eq(storedObjects.status, stored.status))).returning({ id: storedObjects.id });
  if (deleted) await releaseReservedBytes(userId, stored.byteSize, now);
  return Boolean(deleted);
}

export async function sweepOrphanedUserUploads(userId: string, now = new Date()) {
  const references = await referencedUploadKeys(userId);
  const rows = await db.select().from(storedObjects).where(and(eq(storedObjects.userId, userId), inArray(storedObjects.status, ["reserved", "uploaded", "delete_pending"])));
  let deleted = 0;
  for (const row of rows) {
    if (references.has(row.objectKey)) continue;
    const createdAt = new Date(row.uploadedAt ?? row.reservedAt).getTime();
    if (!Number.isFinite(createdAt) || createdAt > now.getTime() - ORPHAN_UPLOAD_GRACE_MS) continue;
    await r2Bucket().delete(row.objectKey);
    const timestamp = now.toISOString();
    const [removed] = await db.update(storedObjects).set({ status: "deleted", deleteAfter: timestamp, updatedAt: timestamp }).where(and(eq(storedObjects.id, row.id), inArray(storedObjects.status, ["reserved", "uploaded", "delete_pending"]))).returning({ id: storedObjects.id });
    if (removed) { await releaseReservedBytes(userId, row.byteSize, timestamp); deleted += 1; }
  }
  return { scanned: rows.length, deleted };
}

export async function runScheduledUploadMaintenance(now = new Date()) {
  if (!r2Configured() || now.getUTCMinutes() % 15 !== 0) return { skipped: true, users: 0, deleted: 0 };
  const userRows = await db.select({ id: users.id }).from(users);
  let deleted = 0;
  for (const user of userRows) {
    const rows = await db.select().from(storedObjects).where(and(eq(storedObjects.userId, user.id), inArray(storedObjects.status, ["reserved", "uploaded", "attached", "delete_pending"])));
    const reservedBytes = rows.reduce((total, row) => total + row.byteSize, 0);
    await db.insert(storageUsage).values({ userId: user.id, reservedBytes, updatedAt: now.toISOString() }).onConflictDoUpdate({ target: storageUsage.userId, set: { reservedBytes, updatedAt: now.toISOString() } });
    deleted += (await sweepOrphanedUserUploads(user.id, now)).deleted;
    const references = await referencedUploadKeys(user.id);
    const tracked = new Set(rows.map((row) => row.objectKey));
    const objects = await listUserUploadObjects(user.id);
    for (const object of objects) {
      if (tracked.has(object.key) || references.has(object.key)) continue;
      if (object.uploaded instanceof Date && object.uploaded.getTime() <= now.getTime() - ORPHAN_UPLOAD_GRACE_MS) {
        await r2Bucket().delete(object.key);
        deleted += 1;
      }
    }
  }
  return { skipped: false, users: userRows.length, deleted };
}

export function isUploadQuotaError(error: unknown): error is UploadQuotaExceededError { return error instanceof UploadQuotaExceededError || (error instanceof Error && error.message.includes("upload storage limit is 50 MB")); }

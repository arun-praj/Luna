export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const USER_UPLOAD_QUOTA_BYTES = 50 * 1024 * 1024;
export const ORPHAN_UPLOAD_GRACE_MS = 24 * 60 * 60 * 1000;

export const uploadKinds = ["account-images", "savings-images", "transaction-receipts"] as const;
export type UploadKind = (typeof uploadKinds)[number];

export class UploadQuotaExceededError extends Error {
  readonly code = "UPLOAD_QUOTA_EXCEEDED";
}

export function uploadPrefix(kind: UploadKind, userId: string) {
  return `${kind}/${userId}/`;
}

/**
 * Returns a key only when the reference is an internal upload owned by the
 * authenticated user. External images and malformed paths are rejected.
 */
export function ownedUploadKey(kind: UploadKind, userId: string, reference: string | null | undefined) {
  if (!reference || reference.includes("?") || reference.includes("#")) return null;
  const apiPrefix = `/api/uploads/${kind}/`;
  const isApiReference = reference.startsWith(apiPrefix);
  const isR2Key = reference.startsWith(`${kind}/`);
  if (!isApiReference && !isR2Key) return null;
  const raw = isApiReference ? reference.slice(apiPrefix.length) : reference;
  const parts = raw.split("/");
  if (parts.length !== (isApiReference ? 2 : 3) || (isR2Key && parts[0] !== kind)) return null;
  let owner: string;
  let filename: string;
  try {
    owner = decodeURIComponent(parts[isApiReference ? 0 : 1] ?? "");
    filename = decodeURIComponent(parts[isApiReference ? 1 : 2] ?? "");
  } catch {
    return null;
  }
  if (owner !== userId || !filename || filename.includes("..") || filename.includes("/")) return null;
  return `${kind}/${owner}/${filename}`;
}

export function uploadQuotaRemaining(usedBytes: number) {
  return Math.max(0, USER_UPLOAD_QUOTA_BYTES - usedBytes);
}

export function staleOrphanUploadKeys(
  objects: Array<{ key: string; uploaded?: Date }>,
  references: ReadonlySet<string>,
  now: Date,
) {
  const cutoff = now.getTime() - ORPHAN_UPLOAD_GRACE_MS;
  return objects
    .filter((object) => !references.has(object.key))
    .filter((object) => object.uploaded instanceof Date && object.uploaded.getTime() <= cutoff)
    .map((object) => object.key);
}

export function assertUploadFitsQuota(usedBytes: number, incomingBytes: number) {
  if (incomingBytes > MAX_UPLOAD_BYTES) {
    throw new RangeError("The upload must be smaller than 5 MB");
  }
  if (usedBytes + incomingBytes > USER_UPLOAD_QUOTA_BYTES) {
    throw new UploadQuotaExceededError("Your upload storage limit is 50 MB. Remove an unused image or receipt before uploading another file.");
  }
}

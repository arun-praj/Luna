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

export function uploadUrl(kind: UploadKind, key: string) {
  const prefix = `${kind}/`;
  const relativeKey = key.startsWith(prefix) ? key.slice(prefix.length) : key;
  return `/api/uploads/${kind}/${relativeKey.split("/").map(encodeURIComponent).join("/")}`;
}

/** Resolves both the current user/file URL and the legacy full-key URL. */
export function resolveUploadRouteKey(kind: UploadKind, userId: string, parts: string[]) {
  let decoded: string;
  try {
    decoded = parts.map(decodeURIComponent).join("/");
  } catch {
    return null;
  }
  if (decoded.includes("..")) return null;
  if (decoded.startsWith(`${userId}/`)) return `${kind}/${decoded}`;
  if (decoded.startsWith(uploadPrefix(kind, userId))) return decoded;
  return null;
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
  if (isR2Key && (parts.length !== 3 || parts[0] !== kind)) return null;
  if (isApiReference && !(parts.length === 2 || (parts.length === 3 && parts[0] === kind))) return null;
  let owner: string;
  let filename: string;
  try {
    const offset = isApiReference && parts.length === 3 ? 1 : 0;
    owner = decodeURIComponent(parts[isR2Key ? 1 : offset] ?? "");
    filename = decodeURIComponent(parts[isR2Key ? 2 : offset + 1] ?? "");
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

export function detectedImageContentType(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return "image/png";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "image/webp";
  if (bytes.length >= 6 && (new TextDecoder().decode(bytes.slice(0, 6)) === "GIF87a" || new TextDecoder().decode(bytes.slice(0, 6)) === "GIF89a")) return "image/gif";
  return null;
}

export function assertImageSignature(bytes: Uint8Array, declaredType: string) {
  if (detectedImageContentType(bytes) !== declaredType) throw new RangeError("The file content does not match its image type");
}

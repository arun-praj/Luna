import "server-only";

import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "./password";

export function parseBackupCodeHashes(value: string | null) {
  if (!value) return [] as string[];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [] as string[];
  }
}

export async function createBackupCodes() {
  const codes = Array.from({ length: 8 }, () => {
    const value = randomBytes(5).toString("hex").toUpperCase();
    return `${value.slice(0, 5)}-${value.slice(5)}`;
  });
  return { codes, hashes: await Promise.all(codes.map((code) => hashPassword(code))) };
}

export async function consumeBackupCode(code: string, hashes: string[]) {
  const normalized = code.replace(/\s/g, "").toUpperCase();
  for (let index = 0; index < hashes.length; index += 1) {
    if (await verifyPassword(normalized, hashes[index])) {
      return { matched: true, remaining: hashes.filter((_, itemIndex) => itemIndex !== index) };
    }
  }
  return { matched: false, remaining: hashes };
}

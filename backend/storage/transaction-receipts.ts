const receiptPathPrefix = "/api/uploads/transaction-receipts/";

/** Convert only a user-owned internal receipt URL into its R2 key. */
export function transactionReceiptKeyForUser(userId: string, reference: string | null | undefined) {
  if (!reference?.startsWith(receiptPathPrefix) || reference.includes("?") || reference.includes("#")) return null;
  const parts = reference.slice(receiptPathPrefix.length).split("/");
  if (parts.length !== 2) return null;
  let owner: string;
  let filename: string;
  try {
    owner = decodeURIComponent(parts[0] ?? "");
    filename = decodeURIComponent(parts[1] ?? "");
  } catch {
    return null;
  }
  if (owner !== userId || !filename || filename.includes("..") || filename.includes("/")) return null;
  return `transaction-receipts/${owner}/${filename}`;
}

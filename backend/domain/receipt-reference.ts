export function isTransactionReceiptReference(value: string) {
  if (value.startsWith("/api/uploads/transaction-receipts/")) {
    const parts = value.split("/");
    return parts.length === 6 && !value.includes("..") && !value.includes("?") && !value.includes("#") && Boolean(parts[4]) && Boolean(parts[5]);
  }
  return false;
}

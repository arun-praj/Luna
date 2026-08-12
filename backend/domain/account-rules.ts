export type AccountNameRecord = { id: string; name: string };

export function normalizeAccountName(name: string) {
  return name.trim().toLocaleLowerCase();
}

export function hasDuplicateAccountName(
  accounts: readonly AccountNameRecord[],
  candidateName: string,
  excludedId?: string,
) {
  const normalized = normalizeAccountName(candidateName);
  return accounts.some((account) => account.id !== excludedId && normalizeAccountName(account.name) === normalized);
}

export function hasDuplicateAccountNames(names: readonly string[]) {
  const normalized = names.map(normalizeAccountName);
  return new Set(normalized).size !== normalized.length;
}

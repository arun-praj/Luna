export type CategoryOrderingOption = {
  id: string;
  name: string;
  usageFrequency?: number;
  usageFrequencyByType?: Partial<Record<string, number>>;
  lastUsedAt?: string | null;
};

function timestampValue(value: string | null | undefined) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function mostRecentCategoryId<T extends CategoryOrderingOption>(options: T[], excludedCategoryId: string | null = null) {
  return options
    .filter((option) => option.id !== excludedCategoryId && timestampValue(option.lastUsedAt) !== Number.NEGATIVE_INFINITY)
    .sort((left, right) => timestampValue(right.lastUsedAt) - timestampValue(left.lastUsedAt))[0]?.id ?? null;
}

export function dedupeCategoryOptions<T extends CategoryOrderingOption>(options: T[], preferredCategoryId: string | null = null) {
  const byName = new Map<string, T>();
  for (const option of options) {
    const key = option.name.trim().toLocaleLowerCase();
    const current = byName.get(key);
    if (!current || option.id === preferredCategoryId || (current.id !== preferredCategoryId && (option.usageFrequency ?? 0) > (current.usageFrequency ?? 0))) byName.set(key, option);
  }
  return [...byName.values()];
}

/** Keep the active and single most-recent category easy to reach, then rank by usage for this transaction type. */
export function orderCategoryOptions<T extends CategoryOrderingOption>(options: T[], selectedCategoryId: string | null, transactionType: string) {
  const uniqueOptions = dedupeCategoryOptions(options, selectedCategoryId);
  const mostRecent = mostRecentCategoryId(uniqueOptions, selectedCategoryId);
  return uniqueOptions.sort((left, right) =>
    Number(right.id === selectedCategoryId) - Number(left.id === selectedCategoryId) ||
    Number(right.id === mostRecent) - Number(left.id === mostRecent) ||
    (right.usageFrequencyByType?.[transactionType] ?? 0) - (left.usageFrequencyByType?.[transactionType] ?? 0) ||
    (right.usageFrequency ?? 0) - (left.usageFrequency ?? 0) ||
    left.name.localeCompare(right.name),
  );
}

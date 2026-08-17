export const categoryUsageTransactionTypes = ["expense", "income", "savings", "transfer", "adjust_balance", "goal_spend"] as const;

export type CategoryUsageTransactionType = (typeof categoryUsageTransactionTypes)[number];
export type CategoryUsageFrequencyByType = Record<CategoryUsageTransactionType, number>;

export type CategoryUsageSummary = {
  usageFrequency: number;
  usageFrequencyByType: CategoryUsageFrequencyByType;
  lastUsedAt: string | null;
};

type CategoryUsageTransaction = {
  categoryId: string | null;
  type: CategoryUsageTransactionType;
  splits: string;
  transactionAt: string;
};

export type CategoryWithUsage = {
  id: string;
  name: string;
  userId: string | null;
  usageFrequency: number;
  usageFrequencyByType: CategoryUsageFrequencyByType;
  lastUsedAt: string | null;
};

export function emptyCategoryUsageFrequencyByType(): CategoryUsageFrequencyByType {
  return { expense: 0, income: 0, savings: 0, transfer: 0, adjust_balance: 0, goal_spend: 0 };
}

function categoryIdsForTransaction(transaction: CategoryUsageTransaction) {
  const categoryIds = new Set<string>();
  if (transaction.categoryId) categoryIds.add(transaction.categoryId);
  try {
    const splits = JSON.parse(transaction.splits) as Array<{ categoryId?: unknown }>;
    for (const split of splits) if (typeof split.categoryId === "string" && split.categoryId) categoryIds.add(split.categoryId);
  } catch {
    // A malformed legacy split should not prevent categories from loading.
  }
  return categoryIds;
}

function isLaterTimestamp(candidate: string, current: string | null) {
  if (!current) return true;
  const candidateTime = Date.parse(candidate);
  const currentTime = Date.parse(current);
  if (Number.isNaN(candidateTime)) return false;
  if (Number.isNaN(currentTime)) return true;
  return candidateTime > currentTime;
}

export function aggregateCategoryUsage(transactions: CategoryUsageTransaction[]) {
  const usageByCategory = new Map<string, CategoryUsageSummary>();
  for (const transaction of transactions) {
    for (const categoryId of categoryIdsForTransaction(transaction)) {
      const current = usageByCategory.get(categoryId) ?? { usageFrequency: 0, usageFrequencyByType: emptyCategoryUsageFrequencyByType(), lastUsedAt: null };
      current.usageFrequency += 1;
      current.usageFrequencyByType[transaction.type] += 1;
      if (isLaterTimestamp(transaction.transactionAt, current.lastUsedAt)) current.lastUsedAt = transaction.transactionAt;
      usageByCategory.set(categoryId, current);
    }
  }
  return usageByCategory;
}

export function dedupeCategoriesByName<T extends CategoryWithUsage>(categoryRows: T[], userId: string) {
  const byName = new Map<string, T>();
  for (const category of categoryRows) {
    const key = category.name.trim().toLocaleLowerCase();
    const current = byName.get(key);
    if (!current) { byName.set(key, category); continue; }
    const representative = category.userId === userId && current.userId !== userId
      ? category
      : current.userId === userId && category.userId !== userId
        ? current
        : category.usageFrequency > current.usageFrequency ? category : current;
    const other = representative === current ? category : current;
    byName.set(key, {
      ...representative,
      usageFrequency: representative.usageFrequency + other.usageFrequency,
      usageFrequencyByType: Object.fromEntries(categoryUsageTransactionTypes.map((type) => [type, representative.usageFrequencyByType[type] + other.usageFrequencyByType[type]])) as CategoryUsageFrequencyByType,
      lastUsedAt: isLaterTimestamp(other.lastUsedAt ?? "", representative.lastUsedAt) ? other.lastUsedAt : representative.lastUsedAt,
    });
  }
  return [...byName.values()];
}

export type RankedTransactionOptionMemory = {
  optionId: string;
  frequency: number;
  lastUsedAt: string;
};

export function rankTransactionOptions<T extends { id: string }>(options: T[], memory: RankedTransactionOptionMemory[]) {
  const memoryById = new Map(memory.map((entry) => [entry.optionId, entry]));
  return options
    .map((option, index) => ({ option, index, memory: memoryById.get(option.id) }))
    .sort((left, right) => (right.memory?.lastUsedAt ?? "").localeCompare(left.memory?.lastUsedAt ?? "") || (right.memory?.frequency ?? 0) - (left.memory?.frequency ?? 0) || left.index - right.index)
    .map(({ option }) => option);
}

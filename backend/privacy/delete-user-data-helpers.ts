const uploadPrefixes = ["account-images", "savings-images", "transaction-receipts"] as const;

export type AccountDeletionStorage = {
  list(options: { prefix: string; cursor?: string }): Promise<{ objects: Array<{ key: string }>; truncated: boolean; cursor?: string }>;
  delete(keys: string[]): Promise<void>;
};

/** Removes every object uploaded under the user's private R2 prefixes, including orphaned uploads. */
export async function deleteUserUploadObjects(storage: AccountDeletionStorage, userId: string) {
  for (const prefix of uploadPrefixes) {
    let cursor: string | undefined;
    do {
      const page = await storage.list({ prefix: `${prefix}/${userId}/`, ...(cursor ? { cursor } : {}) });
      if (page.objects.length > 0) await storage.delete(page.objects.map((object) => object.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
}

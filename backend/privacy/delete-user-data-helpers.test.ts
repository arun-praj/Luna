import assert from "node:assert/strict";
import test from "node:test";

import { deleteUserUploadObjects } from "./delete-user-data-helpers.ts";

test("account deletion removes every private upload prefix and follows R2 pagination", async () => {
  const listed: Array<{ prefix: string; cursor?: string }> = [];
  const deleted: string[][] = [];
  const storage = {
    async list(options: { prefix: string; cursor?: string }) {
      listed.push(options);
      if (options.prefix.startsWith("account-images/") && !options.cursor) return { objects: [{ key: "account-images/user-1/a.png" }], truncated: true, cursor: "next" };
      if (options.prefix.startsWith("account-images/") && options.cursor === "next") return { objects: [{ key: "account-images/user-1/b.png" }], truncated: false };
      return { objects: [], truncated: false };
    },
    async delete(keys: string[]) { deleted.push(keys); },
  };

  await deleteUserUploadObjects(storage, "user-1");

  assert.deepEqual(listed, [
    { prefix: "account-images/user-1/" },
    { prefix: "account-images/user-1/", cursor: "next" },
    { prefix: "savings-images/user-1/" },
    { prefix: "transaction-receipts/user-1/" },
  ]);
  assert.deepEqual(deleted, [["account-images/user-1/a.png"], ["account-images/user-1/b.png"]]);
});

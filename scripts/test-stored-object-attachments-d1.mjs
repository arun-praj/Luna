import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const userId = randomUUID();
const accountId = randomUUID();
const invalidAccountId = randomUUID();
const objectId = randomUUID();
const now = new Date().toISOString();
const key = `account-images/${userId}/fixture.jpg`;
const reference = `/api/uploads/account-images/${userId}/fixture.jpg`;

function run(command) {
  const output = execFileSync("npx", ["wrangler", "d1", "execute", "luna", "--local", "--command", command, "--json"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(output)?.[0]?.results ?? [];
}

function expectFailure(command, label) {
  try {
    run(command);
  } catch {
    return;
  }
  throw new Error(`${label}: expected database guard to reject the mutation`);
}

const cleanup = () => {
  try {
    run(`DELETE FROM stored_objects WHERE user_id = '${userId}'; DELETE FROM accounts WHERE user_id = '${userId}'; DELETE FROM users WHERE id = '${userId}';`);
  } catch {
    // Preserve the original assertion if cleanup itself cannot run.
  }
};

try {
  execFileSync("npx", ["wrangler", "d1", "migrations", "apply", "luna", "--local"], { cwd: new URL("..", import.meta.url), stdio: "ignore" });
  run(`INSERT INTO users (id, name, email, password_hash, email_verified_at, created_at, updated_at) VALUES ('${userId}', 'Attachment Fixture', '${userId}@example.test', 'fixture', '${now}', '${now}', '${now}');`);
  run(`INSERT INTO stored_objects (id, user_id, object_key, kind, byte_size, content_type, checksum, status, reserved_at, uploaded_at, created_at, updated_at) VALUES ('${objectId}', '${userId}', '${key}', 'account-images', 10, 'image/jpeg', 'fixture', 'uploaded', '${now}', '${now}', '${now}', '${now}');`);

  // Production sends these two statements in one D1 batch. The trigger proves
  // the entity cannot be written unless the attachment state is already valid.
  run(`UPDATE stored_objects SET status = 'attached', entity_type = 'account', entity_id = '${accountId}', delete_after = NULL, updated_at = '${now}' WHERE id = '${objectId}' AND status = 'uploaded';`);
  run(`INSERT INTO accounts (id, user_id, name, type, currency, icon) VALUES ('${accountId}', '${userId}', 'Attached account', 'cash', 'NPR', '${reference}');`);
  const attached = run(`SELECT status, entity_type, entity_id FROM stored_objects WHERE id = '${objectId}';`);
  if (attached[0]?.status !== "attached" || attached[0]?.entity_id !== accountId) throw new Error("valid attachment did not become attached");

  // A missing transition cannot leave an entity containing a private reference.
  expectFailure(`INSERT INTO accounts (id, user_id, name, type, currency, icon) VALUES ('${invalidAccountId}', '${userId}', 'Invalid account', 'cash', 'NPR', '${reference}');`, "invalid attachment");
  if (run(`SELECT id FROM accounts WHERE id = '${invalidAccountId}';`).length !== 0) throw new Error("invalid account was persisted");
  console.log("D1 stored-object attachment integration test passed: valid attachment commits and invalid reference is rejected");
} finally {
  cleanup();
}

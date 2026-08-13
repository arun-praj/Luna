import { execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";

const baseUrl = "http://127.0.0.1:8800";
const userId = randomUUID();
const resetId = randomUUID();
const refreshId = randomUUID();
const grantId = randomUUID();
const triggerName = `reset_failure_${randomUUID().replaceAll("-", "")}`;
const guardTable = `reset_failure_guard_${randomUUID().replaceAll("-", "")}`;
const rawToken = `reset-fixture-${randomUUID()}-long-enough`;
const tokenHash = createHash("sha256").update(rawToken).digest("hex");
const now = new Date().toISOString();
const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function run(command) {
  const output = execFileSync("npx", ["wrangler", "d1", "execute", "luna", "--local", "--command", command, "--json"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(output).flatMap((entry) => entry.results ?? []);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function reset(password) {
  const response = await fetch(`${baseUrl}/api/auth/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: rawToken, password }),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

const cleanup = () => {
  try {
    run(`DROP TRIGGER IF EXISTS ${triggerName}; DROP TABLE IF EXISTS ${guardTable}; DELETE FROM password_reset_tokens WHERE id = ${quote(resetId)}; DELETE FROM refresh_tokens WHERE id = ${quote(refreshId)}; DELETE FROM webauthn_unlock_grants WHERE id = ${quote(grantId)}; DELETE FROM users WHERE id = ${quote(userId)};`);
  } catch {
    // Preserve the assertion that caused the test to fail.
  }
};

const worker = spawn("npx", ["wrangler", "dev", "--local", "--port", "8800", "--log-level", "error"], { cwd: new URL("..", import.meta.url), stdio: "ignore" });
try {
  run(`INSERT INTO users (id, name, email, password_hash, email_verified_at, created_at, updated_at) VALUES (${quote(userId)}, 'Reset Fixture', ${quote(`${userId}@example.test`)}, 'old-password-hash', ${quote(now)}, ${quote(now)}, ${quote(now)}); INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (${quote(resetId)}, ${quote(userId)}, ${quote(tokenHash)}, ${quote(future)}, ${quote(now)}); INSERT INTO refresh_tokens (id, user_id, token_hash, issued_at, expires_at) VALUES (${quote(refreshId)}, ${quote(userId)}, ${quote(`refresh-${refreshId}`)}, ${quote(now)}, ${quote(future)}); INSERT INTO webauthn_unlock_grants (id, user_id, expires_at, created_at) VALUES (${quote(grantId)}, ${quote(userId)}, ${quote(future)}, ${quote(now)}); CREATE TABLE ${guardTable} (id INTEGER PRIMARY KEY CHECK (id = 1)); CREATE TRIGGER ${triggerName} BEFORE UPDATE OF password_hash ON users BEGIN INSERT INTO ${guardTable} (id) VALUES (0); END;`);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await fetch(`${baseUrl}/api/auth/me`);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  const failed = await reset("new-password-before-failure");
  assert(failed.status === 500, `injected reset failure should return 500, received ${failed.status}`);
  const rolledBack = run(`SELECT password_hash, used_at, claim_id FROM users u JOIN password_reset_tokens t ON t.user_id = u.id WHERE u.id = ${quote(userId)}; SELECT revoked_at FROM refresh_tokens WHERE id = ${quote(refreshId)}; SELECT revoked_at FROM webauthn_unlock_grants WHERE id = ${quote(grantId)};`);
  assert(rolledBack[0]?.password_hash === "old-password-hash", "failed batch changed the password");
  assert(rolledBack[0]?.used_at == null && rolledBack[0]?.claim_id == null, "failed batch left the reset token finalized or claimed");
  assert(rolledBack[1]?.revoked_at == null && rolledBack[2]?.revoked_at == null, "failed batch revoked sessions or grants partially");

  run(`DROP TRIGGER ${triggerName}; DROP TABLE ${guardTable};`);
  const succeeded = await reset("new-password-after-retry");
  assert(succeeded.status === 200, `reset retry should succeed, received ${succeeded.status}`);
  const committed = run(`SELECT used_at, claim_id, finalized_at FROM password_reset_tokens WHERE id = ${quote(resetId)}; SELECT revoked_at FROM refresh_tokens WHERE id = ${quote(refreshId)}; SELECT revoked_at FROM webauthn_unlock_grants WHERE id = ${quote(grantId)};`);
  assert(committed[0]?.used_at && committed[0]?.finalized_at && committed[0]?.claim_id, "successful reset did not finalize its token");
  assert(committed[1]?.revoked_at && committed[2]?.revoked_at, "successful reset did not revoke sessions and biometric grants");
  const replay = await reset("replayed-password");
  assert(replay.status === 400, `finalized reset token should reject replay, received ${replay.status}`);
  console.log("Password reset atomicity integration test passed: failed batch rolled back and retry committed all security state");
} finally {
  cleanup();
  worker.kill("SIGTERM");
}

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const cwd = new URL("..", import.meta.url);
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
function run(command) {
  const output = execFileSync("npx", ["wrangler", "d1", "execute", "luna", "--local", "--command", command, "--json"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return JSON.parse(output)?.[0]?.results ?? [];
}
function assert(condition, message) { if (!condition) throw new Error(message); }

const userId = randomUUID();
const pendingId = randomUUID();
const resetId = randomUUID();
const now = new Date().toISOString();
const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const cleanup = () => {
  run(`DELETE FROM password_reset_tokens WHERE id = ${quote(resetId)}; DELETE FROM pending_registrations WHERE id = ${quote(pendingId)}; DELETE FROM storage_usage WHERE user_id = ${quote(userId)}; DELETE FROM users WHERE id = ${quote(userId)};`);
};

try {
  run(`INSERT INTO users (id, name, email, password_hash, currency, created_at, updated_at) VALUES (${quote(userId)}, 'Security test', ${quote(`${userId}@example.invalid`)}, 'hash', 'NPR', ${quote(now)}, ${quote(now)});`);
  run(`INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (${quote(resetId)}, ${quote(userId)}, ${quote(`hash-${resetId}`)}, ${quote(future)}, ${quote(now)});`);
  const firstClaim = run(`UPDATE password_reset_tokens SET claim_id = 'winner-a', claimed_at = ${quote(now)} WHERE id = ${quote(resetId)} AND used_at IS NULL AND claim_id IS NULL AND expires_at > ${quote(now)} RETURNING id;`);
  const secondClaim = run(`UPDATE password_reset_tokens SET claim_id = 'winner-b', claimed_at = ${quote(now)} WHERE id = ${quote(resetId)} AND used_at IS NULL AND claim_id IS NULL AND expires_at > ${quote(now)} RETURNING id;`);
  assert(firstClaim.length === 1, "first password reset claimant must win");
  assert(secondClaim.length === 0, "replayed password reset claimant must lose");

  run(`INSERT INTO pending_registrations (id, email, password_hash, currency, verification_code_hash, verification_expires_at, created_at, updated_at) VALUES (${quote(pendingId)}, ${quote(`${pendingId}@example.invalid`)}, 'hash', 'NPR', 'code-hash', ${quote(future)}, ${quote(now)}, ${quote(now)});`);
  const pendingClaim = run(`UPDATE pending_registrations SET verification_claim_id = 'winner-a', verification_claimed_at = ${quote(now)} WHERE id = ${quote(pendingId)} AND verification_claim_id IS NULL AND verification_expires_at > ${quote(now)} RETURNING id;`);
  const pendingReplay = run(`UPDATE pending_registrations SET verification_claim_id = 'winner-b', verification_claimed_at = ${quote(now)} WHERE id = ${quote(pendingId)} AND verification_claim_id IS NULL AND verification_expires_at > ${quote(now)} RETURNING id;`);
  assert(pendingClaim.length === 1 && pendingReplay.length === 0, "pending registration promotion must be single-winner");

  run(`INSERT INTO storage_usage (user_id, reserved_bytes, updated_at) VALUES (${quote(userId)}, 0, ${quote(now)});`);
  assert(run(`UPDATE storage_usage SET reserved_bytes = reserved_bytes + 52428800, updated_at = ${quote(now)} WHERE user_id = ${quote(userId)} AND reserved_bytes + 52428800 <= 52428800 RETURNING user_id;`).length === 1, "quota reservation at the exact limit must succeed");
  assert(run(`UPDATE storage_usage SET reserved_bytes = reserved_bytes + 1, updated_at = ${quote(now)} WHERE user_id = ${quote(userId)} AND reserved_bytes + 1 <= 52428800 RETURNING user_id;`).length === 0, "quota reservation above the limit must fail atomically");
  console.log("D1 security integration test passed: reset claims, pending promotion, and quota reservations are single-winner and bounded");
} finally {
  cleanup();
}

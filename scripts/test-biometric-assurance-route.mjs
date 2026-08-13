import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { SignJWT } from "jose";

const baseUrl = "http://127.0.0.1:8799";
const userId = randomUUID();
const grantId = randomUUID();
const now = new Date().toISOString();

function localSecret() {
  const line = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").split("\n").find((value) => value.startsWith("AUTH_JWT_SECRET="));
  if (!line) throw new Error("AUTH_JWT_SECRET is required in .dev.vars for the local route test");
  return line.slice("AUTH_JWT_SECRET=".length).trim();
}

function runD1(command) {
  execFileSync("npx", ["wrangler", "d1", "execute", "luna", "--local", "--command", command, "--json"], {
    cwd: new URL("..", import.meta.url),
    stdio: "ignore",
  });
}

async function token(unlockGrantId) {
  const builder = new SignJWT({ type: "access", ...(unlockGrantId ? { unlockGrantId } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer("budget-api")
    .setAudience("budget-app")
    .setIssuedAt()
    .setExpirationTime("15m");
  return builder.sign(new TextEncoder().encode(localSecret()));
}

async function request(path, accessToken, init = {}) {
  return fetch(`${baseUrl}${path}`, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${accessToken}` } });
}

async function expectStatus(path, accessToken, status, label, init) {
  const response = await request(path, accessToken, init);
  if (response.status !== status) throw new Error(`${label}: expected ${status}, received ${response.status}`);
  return response;
}

const cleanup = () => {
  try { runD1(`DELETE FROM webauthn_unlock_grants WHERE user_id = '${userId}'; DELETE FROM users WHERE id = '${userId}';`); } catch { /* preserve original failure */ }
};

const worker = spawn("npx", ["wrangler", "dev", "--local", "--port", "8799", "--log-level", "error"], { cwd: new URL("..", import.meta.url), stdio: "ignore" });
try {
  runD1(`INSERT INTO users (id, name, email, password_hash, email_verified_at, biometric_lock_enabled, created_at, updated_at) VALUES ('${userId}', 'Assurance Fixture', '${userId}@example.test', 'fixture', '${now}', 1, '${now}', '${now}'); INSERT INTO webauthn_unlock_grants (id, user_id, expires_at, created_at) VALUES ('${grantId}', '${userId}', '2099-01-01T00:00:00.000Z', '${now}');`);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(`${baseUrl}/api/auth/me`)).status) break; } catch { await new Promise((resolve) => setTimeout(resolve, 500)); }
  }
  const baseToken = await token();
  const unlockedToken = await token(grantId);
  await expectStatus("/api/auth/webauthn", baseToken, 401, "locked token cannot disable biometrics", { method: "DELETE" });
  await expectStatus("/api/auth/webauthn/register/options", baseToken, 401, "locked token cannot start registration", { method: "POST" });
  await expectStatus("/api/accounts", baseToken, 401, "locked token cannot access financial APIs");
  await expectStatus("/api/auth/me", baseToken, 200, "base token can inspect the current account");
  await expectStatus("/api/accounts", unlockedToken, 200, "unlocked token can access financial APIs");
  await expectStatus("/api/auth/webauthn", unlockedToken, 200, "fresh unlocked session can disable biometrics", { method: "DELETE" });
  console.log("WebAuthn assurance route integration test passed: base, unlocked, and fresh-management boundaries enforced");
} finally {
  cleanup();
  worker.kill("SIGTERM");
}

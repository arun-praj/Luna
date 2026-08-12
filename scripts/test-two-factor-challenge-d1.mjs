import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const key = `two-factor-test-${randomUUID()}`;

function run(command) {
  const output = execFileSync("npx", ["wrangler", "d1", "execute", "luna", "--local", "--command", command, "--json"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(output)?.[0]?.results ?? [];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const now = new Date().toISOString();
const cleanup = () => run(`DELETE FROM auth_rate_limits WHERE key = '${key}';`);

try {
  run(`INSERT INTO auth_rate_limits (key, window_started_at, attempts, updated_at) VALUES ('${key}', '${now}', 0, '${now}');`);
  for (let expected = 1; expected <= 5; expected += 1) {
    const result = run(`UPDATE auth_rate_limits SET attempts = attempts + 1, updated_at = '${now}' WHERE key = '${key}' AND attempts < 5 RETURNING attempts;`);
    assert(Number(result[0]?.attempts) === expected, `expected challenge attempt ${expected} to be accepted`);
  }
  assert(run(`UPDATE auth_rate_limits SET attempts = attempts + 1 WHERE key = '${key}' AND attempts < 5 RETURNING attempts;`).length === 0, "sixth challenge attempt must be rejected");
  assert(run(`UPDATE auth_rate_limits SET attempts = 6, updated_at = '${now}' WHERE key = '${key}' AND attempts < 6 RETURNING key;`).length === 1, "first successful challenge consume must win");
  assert(run(`UPDATE auth_rate_limits SET attempts = 6, updated_at = '${now}' WHERE key = '${key}' AND attempts < 6 RETURNING key;`).length === 0, "replayed challenge must not create another session");
  console.log("D1 two-factor challenge integration test passed: five-attempt budget and single-use consume enforced");
} finally {
  cleanup();
}

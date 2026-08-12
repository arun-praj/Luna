# Luna backend and local-first contract

This file is the implementation contract for the backend and offline PWA. Changes must preserve these choices unless the project owner explicitly changes them.

## Stack

- Next.js 16 App Router route handlers for the HTTP API.
- Cloudflare D1 (SQLite) as the deployed remote source of truth.
- PostgreSQL remains available for local tooling and migrations through the separate `schema-postgres.ts` path.
- Drizzle ORM with separate SQLite/D1 and PostgreSQL schemas and migration directories.
- Signed short-lived access JWTs plus rotating opaque refresh tokens stored hashed on the server.
- RxDB in the browser, backed by the free Dexie/IndexedDB storage adapter, for durable per-device data.
- A service worker for the offline application shell, navigation fallback, notifications, and reconnect sync signals.

## Local-first rules

1. The authenticated online API remains the remote source of truth.
2. Successful online reads refresh the user's local RxDB snapshot.
3. Transaction entry must remain available without a network connection.
4. An offline transaction is written to RxDB first with a stable `clientGeneratedId` and `syncStatus: "pending"`.
5. Reconnect sync posts queued writes to `/api/transactions/sync` and then refreshes the local snapshot.
6. Server transaction creation must remain idempotent by `clientGeneratedId`; retrying the same queued write must not create a duplicate.
7. A failed queued write remains visible locally with `syncStatus: "failed"` and may be retried later. Never silently discard it.
8. Cached data is isolated by `userId`. Public/auth routes must never expose another user's cached home screen.
9. Offline mode shows only the current month's cached transactions. Profile editing, filters, and server-only operations require connectivity.
10. Network availability is confirmed with the connectivity endpoint, not only `navigator.onLine`.

## Offline navigation and sync

- `/offline` is the dedicated offline home.
- `/api/pwa/connectivity` is the lightweight same-origin network probe.
- When an authenticated or previously cached user loses connectivity, the runtime opens `/offline`.
- When connectivity returns, pending writes sync before the latest server snapshot is fetched, then the app returns to `/`.
- Background Sync is used as a wake-up hint when supported. Opening the app, an `online` event, visibility changes, and periodic checks are the reliable fallbacks.

## Security and data handling

- Passwords, OTPs, and refresh tokens are never stored plaintext.
- The offline database may contain the user's budget data, so it must not be shared across users and must never include password hashes, OTP codes, refresh tokens, or raw access tokens.
- Offline writes may be queued while the access token is expired. Refresh/authentication is retried when connectivity returns before sync proceeds.
- Explicit sign-out ends the remote session; cached budget data remains device-local for offline continuity unless the user requests local-data removal.

## Current scope

The offline write path covers transactions and the core budget allocation mutation. Budget recommendations, 50/30/20 setup, bucket assignments, transfers, and review calculations are server-backed operations; the cached budget snapshot remains available for offline reading. Accounts, categories, savings instruments, and the profile are cached read-only for composing and rendering offline transactions.

## Database paths

- `backend/db/schema-sqlite.ts` is the application schema used by D1 and local Wrangler development.
- `backend/db/schema-postgres.ts` is retained for PostgreSQL migrations and local PostgreSQL tooling.
- `backend/db/migrations-d1` contains D1 migrations generated with `drizzle.sqlite.config.ts`.
- `backend/db/migrations-postgres` contains PostgreSQL migrations generated with `drizzle.config.ts`.
- The deployed Worker receives D1 as the `DB` binding declared in `wrangler.jsonc`.
- `users.monthly_report_enabled` stores the opt-in for automated monthly PDF reports.
- `report_deliveries` prevents duplicate monthly emails for the same user and period.
- `goals.account_id` designates the account that holds a goal's funds. Goal-linked `savings` transactions record the spendable source in `account_id`, the goal account in `transfer_to_account_id`, and a signed amount; `goal_spend` references the goal account but does not change account balances. The transaction service applies and reverses both account sides and the goal allocation together.
- Financial mutations are committed through one D1 `batch()` call. Transaction, account, goal, savings-instrument, and audit-history writes use compare-and-set guards inside that batch so concurrent changes roll back the entire mutation rather than leaving partial effects.
- Budgets use `budget_templates` for recurring defaults, `budget_periods` for dated historical periods, and `budget_allocations` for per-period plans. Expense allocations consume the manually entered overall spending plan; `unallocated` is the overall plan less category allocations. Savings targets are separate allocations and positive `savings` transactions count toward their actuals.
- Budget recommendations use the median of up to six completed periods and are previewed before application. The optional 50/30/20 setup stores per-category `needs`/`wants` assignments in `budget_category_buckets` and creates an 80% expense plan plus a 20% savings target.
- Rollover rules are stored on templates and materialized into each allocation. Transfers between expense categories are recorded in `budget_moves`, committed atomically with the allocation changes, and can be reversed by creating an auditable inverse move.
- Allocation and move references on the new budget tables use `ON DELETE RESTRICT`; category bucket mappings intentionally cascade with category deletion. The legacy `spending_budgets` table remains only as a migration/import compatibility source. Budget templates, allocations, buckets, and moves are included in portability exports/imports.
- `GET /api/admin/consistency/accounts` requires the `CRON_SECRET` bearer token and recalculates each account as `opening_balance + transaction ledger delta`, returning material mismatches for operational repair.

Generate and apply D1 migrations with:

```bash
npm run db:generate:d1
npm run db:migrate:d1:local
npm run db:migrate:d1:remote
```

## Cloudflare and GitHub deployment

`.github/workflows/deploy.yml` deploys automatically after a push to `main`. GitHub needs these repository or environment secrets:

- `CLOUDFLARE_API_TOKEN`: a scoped Cloudflare API token with Workers and D1 deployment permissions.
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID.

The D1 database ID is configuration, not a secret. Runtime application secrets should stay in Cloudflare Worker secrets, not GitHub or `.env.local`. Set them once with Wrangler, for example:

```bash
npx wrangler secret put AUTH_JWT_SECRET
npx wrangler secret put AUTH_ENCRYPTION_KEY
npx wrangler secret put CRON_SECRET
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT
```

Generate the VAPID key pair once with `npx web-push generate-vapid-keys`. The public key is also needed as the `NEXT_PUBLIC_VAPID_PUBLIC_KEY` GitHub Actions secret so the browser can create a push subscription. The private key must never be placed in the browser build, GitHub source, or a committed environment file.

`APP_URL` is a non-secret Worker variable configured in `wrangler.jsonc`. The `R2` binding points to the `budgeyy` bucket and is used directly by the upload routes; R2 access keys are not needed by the Worker. Add SMTP secrets only when those features are enabled. The GitHub workflow deploys code and migrations without copying local development secrets into CI.

Report delivery uses the existing Node-compatible SMTP mailer and `pdf-lib`. Keep `SMTP_FROM` on the authenticated sender domain, configure SPF/DKIM/DMARC with the mail provider, and store `SMTP_PASSWORD`, `NVIDIA_AI_API_KEY`, and other runtime secrets as Worker secrets rather than in source control. The NVIDIA adapter expects an OpenAI-compatible `/chat/completions` endpoint and falls back to local deterministic insights when unavailable.

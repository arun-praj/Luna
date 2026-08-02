# Luna backend and local-first contract

This file is the implementation contract for the backend and offline PWA. Changes must preserve these choices unless the project owner explicitly changes them.

## Stack

- Next.js 16 App Router route handlers for the HTTP API.
- PostgreSQL as the remote source of truth.
- Drizzle ORM with the PostgreSQL dialect for schema and migrations.
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

The offline write path currently covers transactions. Accounts, categories, savings instruments, and the profile are cached read-only for composing and rendering offline transactions. Their offline editing can be added later using the same outbox and idempotency rules.

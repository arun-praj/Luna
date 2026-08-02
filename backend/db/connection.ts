export function getDatabaseUrl(raw = process.env.DATABASE_URL) {
  if (!raw) throw new Error("DATABASE_URL is required to connect to PostgreSQL.");

  const url = new URL(raw);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1") {
    url.searchParams.delete("sslmode");
    url.searchParams.delete("ssl");
  }

  return url.toString();
}

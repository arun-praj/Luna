import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { dataImports } from "@/backend/db/schema";
import { importPortableData, MAX_IMPORT_BYTES, PortabilityLimitError } from "@/backend/domain/data-portability";
import { checkRateLimit, rateLimitHeaders } from "@/backend/auth/rate-limit";


async function readBodyWithinLimit(request: Request) {
  if (!request.body) return { body: "", bytes: 0 };
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_IMPORT_BYTES) return null;
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  return { body, bytes };
}

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const [ipLimit, userLimit] = await Promise.all([
    checkRateLimit(request, "privacy-import-ip", { limit: 10, windowMs: 60 * 60 * 1000, keyBy: "ip" }),
    checkRateLimit(request, "privacy-import-user", { limit: 3, windowMs: 60 * 60 * 1000, keyBy: "identifier" }, userId),
  ]);
  if (!ipLimit.allowed || !userLimit.allowed) {
    const retryAfterSeconds = Math.max(ipLimit.retryAfterSeconds, userLimit.retryAfterSeconds);
    return NextResponse.json({ error: "Too many import attempts. Please try again later." }, { status: 429, headers: rateLimitHeaders(retryAfterSeconds) });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_IMPORT_BYTES) return errorResponse("The backup must be smaller than 25 MB", 413);
  const bodyResult = await readBodyWithinLimit(request);
  if (!bodyResult || !bodyResult.body) return errorResponse("The backup must be a JSON file smaller than 25 MB", 413);
  const { body, bytes } = bodyResult;
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { return errorResponse("Choose a valid Luna JSON backup", 400); }
  const record = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : null;
  const importId = randomUUID();
  const requestedAt = new Date().toISOString();
  await db.insert(dataImports).values({ id: importId, userId, sourceExportedAt: typeof record?.exportedAt === "string" ? record.exportedAt : null, status: "requested", requestedAt, bytes });
  try {
    const result = await importPortableData(userId, payload);
    await db.update(dataImports).set({ status: "completed", completedAt: new Date().toISOString(), itemCount: result.itemCount }).where(and(eq(dataImports.id, importId), eq(dataImports.userId, userId)));
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    await db.update(dataImports).set({ status: "failed", completedAt: new Date().toISOString() }).where(eq(dataImports.id, importId));
    return errorResponse(error instanceof Error ? error.message : "We could not import this backup", error instanceof PortabilityLimitError ? 413 : 400);
  }
}

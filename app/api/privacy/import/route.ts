import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { dataImports } from "@/backend/db/schema";
import { importPortableData, MAX_IMPORT_BYTES } from "@/backend/domain/data-portability";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_IMPORT_BYTES) return errorResponse("The backup must be smaller than 25 MB", 413);
  const body = await request.text();
  const bytes = Buffer.byteLength(body, "utf8");
  if (!body || bytes > MAX_IMPORT_BYTES) return errorResponse("The backup must be a JSON file smaller than 25 MB", 413);
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
    return errorResponse(error instanceof Error ? error.message : "We could not import this backup", 400);
  }
}

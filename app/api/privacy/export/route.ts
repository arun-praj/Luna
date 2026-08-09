import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { dataExports, users } from "@/backend/db/schema";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { createPortableExport } from "@/backend/domain/data-portability";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return errorResponse("Authentication required", 401);
  const exportId = randomUUID();
  const requestedAt = new Date().toISOString();
  await db.insert(dataExports).values({ id: exportId, userId, emailSnapshot: user.email, format: "json", status: "requested", requestedAt, completedAt: null, bytes: null });
  try {
    const payload = await createPortableExport(userId, requestedAt);
    const body = JSON.stringify(payload, null, 2);
    const bytes = Buffer.byteLength(body, "utf8");
    await db.update(dataExports).set({ status: "completed", completedAt: new Date().toISOString(), bytes }).where(and(eq(dataExports.id, exportId), eq(dataExports.userId, userId)));
    return new Response(body, { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="luna-backup-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" } });
  } catch {
    await db.update(dataExports).set({ status: "failed", completedAt: new Date().toISOString() }).where(eq(dataExports.id, exportId));
    return errorResponse("We could not prepare your backup. Please try again.", 500);
  }
}

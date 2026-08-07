import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { r2Bucket, r2Configured } from "@/backend/storage/r2";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  if (!r2Configured()) return new NextResponse("Image storage is not configured", { status: 503 });
  const { key: parts } = await params;
  const key = parts.map(decodeURIComponent).join("/");
  if (!key.startsWith(`account-images/${userId}/`) || key.includes("..")) return new NextResponse("Not found", { status: 404 });
  try {
    const object = await r2Bucket().get(key);
    if (!object) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": object.httpMetadata?.cacheControl ?? "public, max-age=31536000, immutable", "ETag": object.httpEtag } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

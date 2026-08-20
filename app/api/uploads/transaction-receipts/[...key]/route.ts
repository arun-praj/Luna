import { NextResponse } from "next/server";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { r2Bucket, r2Configured } from "@/backend/storage/r2";
import { deleteUploadIfUnreferenced } from "@/backend/storage/upload-lifecycle";
import { resolveUploadRouteKey } from "@/backend/storage/upload-policy";


export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  if (!r2Configured()) return new NextResponse("Receipt storage is not configured", { status: 503 });

  const { key: parts } = await params;
  const key = resolveUploadRouteKey("transaction-receipts", userId, parts);
  if (!key || key.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const object = await r2Bucket().get(key);
    if (!object) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
        "Cache-Control": object.httpMetadata?.cacheControl ?? "private, max-age=31536000, immutable",
        "ETag": object.httpEtag,
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  if (!r2Configured()) return errorResponse("Receipt storage is not configured", 503);
  const { key: parts } = await params;
  const key = resolveUploadRouteKey("transaction-receipts", userId, parts);
  if (!key || key.includes("..")) return new NextResponse("Not found", { status: 404 });
  try {
    const removed = await deleteUploadIfUnreferenced(userId, "transaction-receipts", key);
    if (!removed) return errorResponse("This receipt is still attached to a transaction", 409);
    return new NextResponse(null, { status: 204 });
  } catch {
    return errorResponse("Could not remove receipt", 502);
  }
}

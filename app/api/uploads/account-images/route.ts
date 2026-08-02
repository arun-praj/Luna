import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { r2Bucket, r2Client, r2Configured } from "@/backend/storage/r2";

export const runtime = "nodejs";
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  if (!r2Configured()) return errorResponse("Image storage is not configured", 503);
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return errorResponse("Image file is required", 400);
  if (!allowedTypes.has(file.type)) return errorResponse("Use a JPG, PNG, WebP, or GIF image", 400);
  if (file.size > 5 * 1024 * 1024) return errorResponse("The image must be smaller than 5 MB", 400);
  const key = `account-images/${userId}/${randomUUID()}.${extensions[file.type]}`;
  try {
    await r2Client().send(new PutObjectCommand({ Bucket: r2Bucket(), Key: key, Body: Buffer.from(await file.arrayBuffer()), ContentType: file.type, CacheControl: "public, max-age=31536000, immutable", Metadata: { userId } }));
    return NextResponse.json({ key, url: `/api/uploads/account-images/${key.split("/").map(encodeURIComponent).join("/")}` }, { status: 201 });
  } catch {
    return errorResponse("Could not upload image", 502);
  }
}

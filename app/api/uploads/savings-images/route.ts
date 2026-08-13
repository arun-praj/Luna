import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { r2Configured } from "@/backend/storage/r2";
import { isUploadQuotaError, putUserUpload } from "@/backend/storage/upload-lifecycle";
import { MAX_UPLOAD_BYTES } from "@/backend/storage/upload-policy";
import { checkRateLimit, rateLimitHeaders } from "@/backend/auth/rate-limit";

export const runtime = "nodejs";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const uploadLimit = await checkRateLimit(request, "upload-user", { limit: 100, windowMs: 60 * 60 * 1000 }, userId);
  if (!uploadLimit.allowed) return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429, headers: rateLimitHeaders(uploadLimit.retryAfterSeconds) });
  if (!r2Configured()) return errorResponse("Image storage is not configured", 503);
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return errorResponse("Image file is required", 400);
  if (!allowedTypes.has(file.type)) return errorResponse("Use a JPG, PNG, WebP, or GIF image", 400);
  if (file.size > MAX_UPLOAD_BYTES) return errorResponse("The image must be smaller than 5 MB", 400);
  try {
    const key = await putUserUpload({
      kind: "savings-images",
      userId,
      file,
      extension: extensions[file.type]!,
      cacheControl: "public, max-age=31536000, immutable",
    });
    return NextResponse.json({ key, url: `/api/uploads/savings-images/${key.split("/").map(encodeURIComponent).join("/")}` }, { status: 201 });
  } catch (error) {
    if (isUploadQuotaError(error)) return errorResponse(error.message, 413);
    return errorResponse("Could not upload image", 502);
  }
}

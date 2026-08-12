import { NextResponse } from "next/server";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { r2Configured } from "@/backend/storage/r2";
import { isUploadQuotaError, putUserUpload } from "@/backend/storage/upload-lifecycle";
import { MAX_UPLOAD_BYTES } from "@/backend/storage/upload-policy";

export const runtime = "nodejs";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  if (!r2Configured()) return errorResponse("Receipt storage is not configured", 503);

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return errorResponse("Receipt image is required", 400);
  if (!allowedTypes.has(file.type)) return errorResponse("Use a JPG, PNG, or WebP receipt image", 400);
  if (file.size > MAX_UPLOAD_BYTES) return errorResponse("The receipt image must be smaller than 5 MB", 400);
  try {
    const key = await putUserUpload({
      kind: "transaction-receipts",
      userId,
      file,
      extension: extensions[file.type]!,
      cacheControl: "private, max-age=31536000, immutable",
    });
    return NextResponse.json(
      { key, url: `/api/uploads/transaction-receipts/${key.split("/").map(encodeURIComponent).join("/")}` },
      { status: 201 },
    );
  } catch (error) {
    if (isUploadQuotaError(error)) return errorResponse(error.message, 413);
    return errorResponse("Could not upload receipt", 502);
  }
}

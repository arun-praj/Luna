import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { r2Bucket, r2Client, r2Configured } from "@/backend/storage/r2";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (!r2Configured()) return new NextResponse("Image storage is not configured", { status: 503 });
  const { key: parts } = await params;
  const key = parts.map(decodeURIComponent).join("/");
  if (!key.startsWith("account-images/") || key.includes("..")) return new NextResponse("Not found", { status: 404 });
  try {
    const object = await r2Client().send(new GetObjectCommand({ Bucket: r2Bucket(), Key: key }));
    if (!object.Body) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(Buffer.from(await object.Body.transformToByteArray()), { headers: { "Content-Type": object.ContentType ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable", "ETag": object.ETag ?? "" } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

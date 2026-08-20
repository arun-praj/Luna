import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { portabilityCounts } from "@/backend/domain/data-portability";


export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  return NextResponse.json(await portabilityCounts(userId));
}

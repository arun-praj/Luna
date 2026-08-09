import { NextResponse } from "next/server";

import { dismissHomeAlert } from "@/backend/domain/home-alert-service";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const userId = await requireAccessToken(request);
  const { id } = await params;
  if (!userId) return errorResponse("Authentication required", 401);
  return NextResponse.json({ dismissed: await dismissHomeAlert(userId, id) });
}

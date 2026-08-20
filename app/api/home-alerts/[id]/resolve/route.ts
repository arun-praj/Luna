import { NextResponse } from "next/server";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { resolveHomeAlert } from "@/backend/domain/home-alert-service";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const userId = await requireAccessToken(request);
  const { id } = await params;
  if (!userId) return errorResponse("Authentication required", 401);
  return NextResponse.json({ resolved: await resolveHomeAlert(userId, id) });
}

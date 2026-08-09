import { NextResponse } from "next/server";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { getActivityHomeAlerts, getHomeAlerts } from "@/backend/domain/home-alert-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const view = new URL(request.url).searchParams.get("view");
  return NextResponse.json({ alerts: view === "activity" ? await getActivityHomeAlerts(userId) : await getHomeAlerts(userId) });
}

import { NextResponse } from "next/server";

import { checkAccountBalanceConsistency } from "@/backend/domain/account-consistency";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = new URL(request.url).searchParams.get("userId") ?? undefined;
  return NextResponse.json(await checkAccountBalanceConsistency(userId), { headers: { "Cache-Control": "no-store" } });
}

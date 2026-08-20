import { NextResponse } from "next/server";

import { requireAccessToken } from "@/backend/auth/http";
import { sendTestNotification } from "@/backend/notifications/scheduler";


export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const result = await sendTestNotification(userId);
  if (result === "sent") return NextResponse.json({ delivered: true });
  if (result === "not_configured") {
    return NextResponse.json(
      { error: "Background notifications are not enabled on this device." },
      { status: 409 },
    );
  }
  if (result === "subscription_expired") {
    return NextResponse.json(
      { error: "This device subscription expired. Enable background alerts again." },
      { status: 410 },
    );
  }
  if (result === "rejected") {
    return NextResponse.json(
      { error: "The push service rejected this subscription. Enable background alerts again, then retry the test." },
      { status: 502 },
    );
  }
  return NextResponse.json(
    { error: "The push service could not deliver the test notification." },
    { status: 502 },
  );
}

import { NextResponse } from "next/server";


export async function GET() {
  return NextResponse.json(
    { online: true, checkedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

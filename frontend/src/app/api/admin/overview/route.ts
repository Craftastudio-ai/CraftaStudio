import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND = process.env.BACKEND_URL || "http://craftastudio-env.eba-brn8pyru.us-east-1.elasticbeanstalk.com";

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const res = await fetch(`${BACKEND}/api/admin/overview`, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Admin data fetch failed", details: err.message }, { status: 504 });
  }
}

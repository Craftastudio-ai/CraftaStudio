import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND = process.env.BACKEND_URL || "http://craftastudio-env.eba-brn8pyru.us-east-1.elasticbeanstalk.com";

export async function POST(req: NextRequest) {
  try {
    const { runId } = await req.json();
    if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });

    const auth = req.headers.get("authorization") ?? "";
    const res = await fetch(`${BACKEND}/api/admin/stop/${runId}`, {
      method: "POST",
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Stop request failed", details: err.message }, { status: 504 });
  }
}

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND = process.env.BACKEND_URL || "http://craftastudio-env.eba-brn8pyru.us-east-1.elasticbeanstalk.com";

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    const auth = req.headers.get("authorization") ?? "";

    const res = await fetch(`${BACKEND}/api/plan/status/${jobId}`, {
      method: "GET",
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(10_000), // status check is fast
    });

    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Status check failed", details: err.message }, { status: 503 });
  }
}

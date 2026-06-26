import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BACKEND = process.env.BACKEND_URL || "http://craftastudio-env.eba-brn8pyru.us-east-1.elasticbeanstalk.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = req.headers.get("authorization") ?? "";

    const res = await fetch(`${BACKEND}/api/plan/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55_000),
    });

    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch {
    // Non-fatal — canvas-tab falls back to direct plan generation
    return NextResponse.json({ questions: [] }, { status: 200 });
  }
}

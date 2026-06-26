import { NextRequest, NextResponse } from "next/server";

// Allow up to 5 minutes — plan generation via LLM can be slow
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BACKEND = process.env.BACKEND_URL || "http://craftastudio-env.eba-brn8pyru.us-east-1.elasticbeanstalk.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = req.headers.get("authorization") ?? "";

    const res = await fetch(`${BACKEND}/api/plan/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(280_000),
    });

    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Plan generation failed", details: err.message }, { status: 504 });
  }
}

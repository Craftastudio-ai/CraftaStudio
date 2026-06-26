import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ISR — revalidate every 60 seconds
export const revalidate = 60;

export async function GET(): Promise<NextResponse> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }

  const supabase = createClient(url, key);
  const { count, error } = await supabase
    .from("waitlist")
    .select("*", { count: "exact", head: true });

  if (error) {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }

  return NextResponse.json({ count: count ?? 0 }, { status: 200 });
}

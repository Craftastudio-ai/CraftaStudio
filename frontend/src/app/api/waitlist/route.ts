/**
 * Supabase schema (run once in your Supabase SQL editor):
 *
 * create table if not exists waitlist (
 *   id         uuid         default gen_random_uuid() primary key,
 *   email      text         unique not null,
 *   name       text,
 *   mobile     text,
 *   role       text,
 *   excitement text,
 *   created_at timestamptz  default now(),
 *   source     text         default 'landing'
 * );
 * create index if not exists waitlist_created_at_idx on waitlist(created_at);
 *
 * -- If table already exists, add missing columns:
 * alter table waitlist add column if not exists name       text;
 * alter table waitlist add column if not exists mobile     text;
 * alter table waitlist add column if not exists role       text;
 * alter table waitlist add column if not exists excitement text;
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { z } from "zod";

// ─── Rate limiter (in-memory, per-IP, 3 req / hour) ──────────────────────────

const rateLimitMap = new Map<string, { count: number; reset: number }>();

function isRateLimited(ip: string): boolean {
  const now   = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + 3_600_000 });
    return false;
  }

  if (entry.count >= 3) return true;
  entry.count += 1;
  return false;
}

// ─── Supabase + Resend clients ────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  return createClient(url, key);
}

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY");
  return new Resend(key);
}

// ─── Confirmation email HTML ──────────────────────────────────────────────────

function buildEmail(email: string, position: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>You're on the CraftaStudio waitlist</title>
</head>
<body style="margin:0;padding:0;background:#07070d;font-family:ui-sans-serif,system-ui,sans-serif;color:#f0effe;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07070d;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#0d0d1a;border:1px solid #1e1e38;border-radius:16px;overflow:hidden;max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #1e1e38;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#7c6fee,#5a4fd4);width:32px;height:32px;border-radius:8px;text-align:center;vertical-align:middle;">
                    <span style="color:#fff;font-weight:900;font-size:16px;line-height:32px;">C</span>
                  </td>
                  <td style="padding-left:10px;font-size:15px;font-weight:700;color:#f0effe;vertical-align:middle;">CraftaStudio</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 8px;font-size:28px;font-weight:900;color:#f0effe;line-height:1.2;">
                You&rsquo;re #${position} on the list.
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#9896b8;line-height:1.7;">
                Thanks for joining the waitlist, <strong style="color:#c4bcfa;">${email}</strong>.<br/>
                We&rsquo;ll send you early access before anyone else — in order of signup.
              </p>

              <!-- Position pill -->
              <div style="display:inline-block;background:#7c6fee18;border:1px solid #7c6fee40;border-radius:8px;padding:10px 20px;margin-bottom:28px;">
                <span style="font-family:monospace;font-size:13px;color:#7c6fee;">Position #${position}</span>
              </div>

              <hr style="border:none;border-top:1px solid #1e1e38;margin:0 0 28px;" />

              <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#f0effe;">What happens next?</p>
              <p style="margin:0 0 24px;font-size:13px;color:#9896b8;line-height:1.7;">
                We&rsquo;re targeting a public launch in late 2026. As a waitlist member you&rsquo;ll get:
              </p>
              <ul style="margin:0 0 24px;padding-left:20px;font-size:13px;color:#9896b8;line-height:2;">
                <li>Full platform access at launch</li>
                <li>Priority support channel</li>
                <li>Early-adopter pricing locked in</li>
              </ul>

              <p style="margin:0;font-size:13px;color:#5c5a7a;">
                Questions? Reply to this email or reach us at
                <a href="mailto:hello@craftastudio.ai" style="color:#7c6fee;text-decoration:none;"> hello@craftastudio.ai</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1e1e38;text-align:center;">
              <p style="margin:0;font-size:11px;color:#3a3858;">
                &copy; ${new Date().getFullYear()} CraftaStudio &mdash;
                <a href="https://craftastudio.ai" style="color:#3a3858;text-decoration:none;">craftastudio.ai</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

// ─── POST /api/waitlist ───────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate limit
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Try again in an hour." },
      { status: 429 }
    );
  }

  // Validate body
  let body: unknown;
  try {
    body = await req.json() as unknown;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  const { email, name } = parsed.data;

  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    return NextResponse.json(
      { success: false, error: "Waitlist service is not configured. Please contact us at hello@craftastudio.ai" },
      { status: 503 }
    );
  }

  // Insert into Supabase
  const { error: insertError } = await supabase
    .from("waitlist")
    .insert({ email, name: name ?? null, source: "landing" });

  // Handle duplicate
  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ success: true, duplicate: true }, { status: 200 });
    }
    return NextResponse.json(
      { success: false, error: "Database error. Please try again." },
      { status: 500 }
    );
  }

  // Get position (count of all rows)
  const { count, error: countError } = await supabase
    .from("waitlist")
    .select("*", { count: "exact", head: true });

  const position = countError ? 1 : (count ?? 1);

  // Send confirmation email (fire-and-forget — don't fail the request if Resend fails)
  try {
    const resend = getResend();
    await resend.emails.send({
      from:    "CraftaStudio <team@craftastudio.ai>",
      to:      email,
      subject: "You're on the CraftaStudio waitlist",
      html:    buildEmail(email, position),
    });
  } catch {
    // Non-fatal — still return success
  }

  return NextResponse.json({ success: true, position }, { status: 200 });
}

// ─── PATCH /api/waitlist ──────────────────────────────────────────────────────

const surveySchema = z.object({
  email:      z.string().email(),
  mobile:     z.string().optional(),
  role:       z.string().optional(),
  excitement: z.string().optional(),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json() as unknown;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = surveySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid data." }, { status: 400 });
  }

  const { email, mobile, role, excitement } = parsed.data;

  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    return NextResponse.json({ success: false }, { status: 503 });
  }

  await supabase
    .from("waitlist")
    .update({ mobile: mobile ?? null, role: role ?? null, excitement: excitement ?? null })
    .eq("email", email);

  return NextResponse.json({ success: true }, { status: 200 });
}

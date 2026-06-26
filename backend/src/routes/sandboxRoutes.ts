/**
 * sandboxRoutes.ts
 *
 * FIXES APPLIED:
 * FIX-1 — Added debugScaffold import and route (/api/sandbox/debug-scaffold)
 * FIX-2 — preview-proxy: fixed <base href> to use full path (not just origin)
 *          so Vite asset paths resolve correctly on Daytona subpath URLs
 * FIX-3 — preview-proxy: Set-Cookie now uses SameSite=None; Secure so the
 *          sandbox_target cookie is sent on cross-origin requests from the iframe
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { verifyClerk } from "../middleware/clerkAuth";
import {
  provisionProject,
  deleteSandbox,
  debugScaffold,           // FIX-1: was missing
} from "../controllers/provisionController";
import {
  createSandbox,
  uploadFiles,
  installPackages,
  runProject,
  getSandboxLogs,
} from "../controllers/sandboxController";

export async function sandboxRoutes(app: FastifyInstance) {
  // ─── Full lifecycle (provision = create + scaffold + npm install + vite start) ───
  app.post("/provision", provisionProject as any);
  app.post("/delete",          { preHandler: verifyClerk }, deleteSandbox as any);
  app.post("/debug-scaffold",  { preHandler: verifyClerk }, debugScaffold as any);  // FIX-1

  // ── Low-level sandbox operations ──
  app.post("/create",  { preHandler: verifyClerk }, createSandbox as any);
  app.post("/upload",  { preHandler: verifyClerk }, uploadFiles as any);
  app.post("/install", { preHandler: verifyClerk }, installPackages as any);
  app.post("/run",     { preHandler: verifyClerk }, runProject as any);
  app.post("/logs",    { preHandler: verifyClerk }, getSandboxLogs as any);

  // ── Preview proxy ────────────────────────────────────────────────────────────
  // Strips X-Frame-Options so the Daytona preview loads in our iframe.
  // Also injects a <base href> so relative asset paths resolve correctly, and
  // sets a sandbox_target cookie so the universal proxy in app.ts can forward
  // sub-resource requests (JS/CSS/fonts) that the iframe loads as absolute paths.
  app.get("/preview-proxy", async (req: FastifyRequest, reply) => {
    const { url, token } = req.query as { url?: string; token?: string };

    if (!url) {
      return reply.status(400).send({ error: "url query parameter is required" });
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      return reply.status(400).send({ error: "Invalid url parameter" });
    }

    let sessionCookie = "";

    if (token) {
        const authUrl = new URL(targetUrl.toString());
        authUrl.searchParams.set('token', token);
        try {
          const authRes = await fetch(authUrl.toString(), {
            redirect: "manual",
          signal: AbortSignal.timeout(10000)
        });
        const setCookies = authRes.headers.get("set-cookie");
        if (setCookies) {
          const match = setCookies.match(/session_id=([^;]+)/);
          if (match) {
            sessionCookie = `session_id=${match[1]}`;
          }
        }
      } catch (err: any) {
        console.warn("[preview-proxy] Token exchange error:", err?.message);
      }
    }

    try {
      const fetchHeaders: Record<string, string> = {
        "User-Agent": "CraftaStudio-Preview-Proxy/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      };

      const finalCookies = [];
      if (req.headers.cookie) {
        if (sessionCookie) {
          // If we got a NEW session cookie, strip the OLD one to prevent conflicts
          const cleanCookie = req.headers.cookie
            .split(";")
            .map(c => c.trim())
            .filter(c => !c.startsWith("session_id="))
            .join("; ");
          if (cleanCookie) finalCookies.push(cleanCookie);
        } else {
          // If we didn't get a new session cookie (e.g. token already consumed), keep the existing one!
          finalCookies.push(req.headers.cookie);
        }
      }
      if (sessionCookie) finalCookies.push(sessionCookie);

      if (finalCookies.length > 0) {
        fetchHeaders["Cookie"] = finalCookies.join("; ");
      }

      const upstream = await fetch(targetUrl.toString(), {
        headers: fetchHeaders,
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });

      reply.status(upstream.status);

      // Copy safe headers, dropping frame-blocking and encoding headers
      const skippedHeaders = new Set([
        "x-frame-options",
        "content-security-policy",
        "content-encoding",
        "transfer-encoding",
        "connection",
      ]);

      for (const [name, value] of upstream.headers.entries()) {
        if (!skippedHeaders.has(name.toLowerCase())) {
          reply.header(name, value);
        }
      }

      // Set permissive frame headers
      reply.header("X-Frame-Options", "ALLOWALL");
      reply.header("Content-Security-Policy", "frame-ancestors *");
      reply.header("Access-Control-Allow-Origin", "*");

      let bodyBuf = Buffer.from(await upstream.arrayBuffer());
      const contentType = upstream.headers.get("content-type") || "";

      if (contentType.includes("text/html")) {
        let text = bodyBuf.toString("utf-8");

        // Use the relative path for <base href>, not the origin.
        const pathDir = targetUrl.pathname.replace(/\/[^/]*$/, "/") || "/";
        const baseTag = `<base href="${pathDir}">`;

        if (text.includes("<head>")) {
          text = text.replace("<head>", `<head>\n    ${baseTag}`);
        } else {
          text = baseTag + "\n" + text;
        }

        const isSecure = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
        const cookieFlags = isSecure ? "SameSite=None; Secure" : "";

        const cookies = [
          `sandbox_target=${encodeURIComponent(targetUrl.origin)}; Path=/; ${cookieFlags}; Max-Age=3600`
        ];
        if (token) {
          cookies.push(`sandbox_token=${encodeURIComponent(token)}; Path=/; ${cookieFlags}; Max-Age=3600`);
        }
        if (sessionCookie) {
          cookies.push(`${sessionCookie}; Path=/; ${cookieFlags}; Max-Age=3600`);
        }
        reply.header("Set-Cookie", cookies);

        bodyBuf = Buffer.from(text, "utf-8");
        reply.removeHeader("content-length");
      }

      return reply.send(bodyBuf);
    } catch (err: any) {
      console.error("[preview-proxy] fetch error:", err?.message);
      return reply.status(502).send({ error: "Failed to reach preview URL", detail: err?.message });
    }
  });
}
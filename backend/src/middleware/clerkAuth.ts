import { createRemoteJWKSet, jwtVerify } from "jose";
import { FastifyRequest, FastifyReply } from "fastify";

// Lazy JWKS loader
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    const jwksUrl = process.env.CLERK_JWKS_URL;

    if (!jwksUrl) {
      throw new Error("CLERK_JWKS_URL is not set");
    }

    jwks = createRemoteJWKSet(new URL(jwksUrl));
  }
  return jwks;
}

export async function verifyClerk(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;

    // 🔍 Debug
    console.log("AUTH HEADER:", authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return reply.code(401).send({ error: "Invalid token format" });
    }

    // ✅ DEV BYPASS — only works when NODE_ENV is not 'production'
    if (process.env.NODE_ENV !== "production" && token === "dev-token") {
      console.log("✅ DEV BYPASS: skipping JWT verification");
      (request as any).user = {
        sub: "user_3DFSiSa8FUZaLaKupYZbBfhfLnJ", // pranavgawai1518@gmail.com
      };
      return;
    }

    console.log("TOKEN (first 50 chars):", token.slice(0, 50));

    // ✅ IMPORTANT: minimal verification (no audience issues)
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: process.env.CLERK_ISSUER_URL,
    });

    console.log("✅ VERIFIED USER:", payload.sub);

    // Attach user to request
    (request as any).user = payload;

  } catch (err: any) {
    console.error("❌ Clerk verification failed:", err?.message || err);
    return reply.code(401).send({ error: "Unauthorized" });
  }
}
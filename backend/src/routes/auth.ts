import type { FastifyInstance } from "fastify";
import { verifyClerk } from "../middleware/clerkAuth";
import { getOrCreateUser } from "../lib/getOrCreateUser";

export async function authRoutes(app: FastifyInstance) {
  /**
   * POST /api/auth/sync
   * Called by the frontend right after login.
   * Ensures the authenticated Clerk user exists in our database.
   */
  app.post("/sync", { preHandler: verifyClerk }, async (req: any, reply) => {
    const clerkId = req.user.sub;
    console.log("[auth/sync] clerkId:", clerkId);
    const user = await getOrCreateUser(clerkId);
    console.log("[auth/sync] user saved:", user);
    return reply.code(200).send(user);
  });
}

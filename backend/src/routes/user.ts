import type { FastifyInstance } from "fastify";
import { verifyClerk } from "../middleware/clerkAuth";
import { getOrCreateUser } from "../lib/getOrCreateUser";
import prisma from "../lib/prisma";

export async function userRoutes(app: FastifyInstance) {

  /** GET /api/me */
  app.get("/me", { preHandler: verifyClerk }, async (req: any) => {
    const clerkId = req.user.sub;
    const user = await getOrCreateUser(clerkId);
    return user;
  });

  /** GET /api/workspace — returns teams with projects for the sidebar */
  app.get("/workspace", { preHandler: verifyClerk }, async (req: any) => {
    const clerkId = req.user.sub;
    const user = await getOrCreateUser(clerkId);

    const memberships = await prisma.teamMember.findMany({
      where: { userId: user.id },
      include: {
        team: {
          include: { projects: { orderBy: { createdAt: 'desc' } } }
        }
      },
    });

    const teams = memberships.map(m => ({
      id: m.team.id,
      name: m.team.name,
      projects: m.team.projects.map(p => ({
        id: p.id,
        name: p.name,
        teamId: p.teamId,
        createdAt: p.createdAt,
      })),
    }));

    return { teams };
  });
}
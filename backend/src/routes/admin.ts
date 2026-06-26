import type { FastifyInstance } from "fastify";
import { verifyClerk } from "../middleware/clerkAuth";
import { getOrCreateUser } from "../lib/getOrCreateUser";
import prisma from "../lib/prisma";
import { runAbortControllers } from "../lib/runControllers";
import { broadcastToProject } from "../ws/wsManager";

const ADMIN_EMAIL = "pranavgawai1518@gmail.com";

export async function adminRoutes(app: FastifyInstance) {

  /** GET /api/admin/overview */
  app.get("/overview", { preHandler: verifyClerk }, async (req: any, reply) => {
    const clerkId = req.user.sub;
    const user = await getOrCreateUser(clerkId);

    if (user.email !== ADMIN_EMAIL) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const [
      totalUsers,
      totalProjects,
      totalTeams,
      runAgg,
      runsByStatus,
      blockTokensByType,
      rawUsers,
      recentRuns,
      topProjectRuns,
      errorCount,
      activeUsersToday,
      lastRunsByUser,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.team.count(),

      prisma.workflowRun.aggregate({
        _sum: { totalTokens: true },
        _count: { id: true },
        _avg: { totalTokens: true },
      }),

      prisma.workflowRun.groupBy({
        by: ["status"],
        _count: { id: true },
        _sum: { totalTokens: true },
      }),

      prisma.blockOutput.groupBy({
        by: ["blockType"],
        _sum: { tokensUsed: true },
        _count: { id: true },
        orderBy: { _sum: { tokensUsed: "desc" } },
        take: 8,
      }),

      prisma.user.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { workflowRuns: true, createdProjects: true } },
        },
      }),

      prisma.workflowRun.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          triggeredBy: { select: { email: true, name: true } },
          project: { select: { name: true } },
          _count: { select: { blockOutputs: true } },
        },
      }),

      prisma.workflowRun.groupBy({
        by: ["projectId"],
        _sum: { totalTokens: true },
        _count: { id: true },
        orderBy: { _sum: { totalTokens: "desc" } },
        take: 5,
      }),

      prisma.workflowRun.count({ where: { status: "failed" } }),

      prisma.user.count({
        where: {
          workflowRuns: {
            some: { createdAt: { gte: new Date(Date.now() - 86400000) } },
          },
        },
      }),

      // Last run timestamp + total tokens consumed per user
      prisma.workflowRun.groupBy({
        by: ["triggeredByUserId"],
        _max: { createdAt: true },
        _sum: { totalTokens: true },
        _count: { id: true },
      }),
    ]);

    // Build lookup: userId → { lastRunAt, totalTokensUsed, runCount }
    const userRunMap: Record<string, { lastRunAt: Date | null; totalTokensUsed: number; runCount: number }> = {};
    for (const r of lastRunsByUser) {
      userRunMap[r.triggeredByUserId] = {
        lastRunAt: r._max.createdAt,
        totalTokensUsed: r._sum.totalTokens ?? 0,
        runCount: r._count.id,
      };
    }

    // Resolve project names for top projects
    const projectIds = topProjectRuns.map((r) => r.projectId);
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true },
    });
    const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

    const totalTokens = runAgg._sum.totalTokens ?? 0;
    const totalRuns = runAgg._count.id;
    const avgTokensPerRun = Math.round(runAgg._avg.totalTokens ?? 0);
    const errorRate = totalRuns > 0 ? ((errorCount / totalRuns) * 100).toFixed(1) : "0.0";

    return {
      stats: {
        totalUsers,
        totalProjects,
        totalTeams,
        totalRuns,
        totalTokens,
        avgTokensPerRun,
        errorCount,
        errorRate,
        activeUsersToday,
      },
      runsByStatus: runsByStatus.map((r) => ({
        status: r.status,
        count: r._count.id,
        tokens: r._sum.totalTokens ?? 0,
      })),
      tokensByBlockType: blockTokensByType.map((b) => ({
        blockType: b.blockType,
        tokensUsed: b._sum.tokensUsed ?? 0,
        outputCount: b._count.id,
      })),
      topProjects: topProjectRuns.map((r) => ({
        projectId: r.projectId,
        name: projectMap[r.projectId] ?? "Unknown",
        totalTokens: r._sum.totalTokens ?? 0,
        runCount: r._count.id,
      })),
      recentUsers: rawUsers.map((u) => {
        const runMeta = userRunMap[u.id];
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          createdAt: u.createdAt,
          lastRunAt: runMeta?.lastRunAt ?? null,
          totalTokensUsed: runMeta?.totalTokensUsed ?? 0,
          runCount: u._count.workflowRuns,
          projectCount: u._count.createdProjects,
        };
      }),
      recentRuns: recentRuns.map((r) => ({
        id: r.id,
        prompt: r.prompt,
        status: r.status,
        totalTokens: r.totalTokens,
        blockCount: r._count.blockOutputs,
        createdAt: r.createdAt,
        user: r.triggeredBy,
        project: r.project,
      })),
    };
  });

  /** POST /api/admin/stop/:runId — admin force-stop any run */
  app.post("/stop/:runId", { preHandler: verifyClerk }, async (req: any, reply) => {
    const clerkId = req.user.sub;
    const user = await getOrCreateUser(clerkId);

    if (user.email !== ADMIN_EMAIL) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const { runId } = req.params as { runId: string };

    const run = await prisma.workflowRun.findUnique({ where: { id: runId } });
    if (!run) return reply.code(404).send({ error: "Run not found" });

    const controller = runAbortControllers.get(runId);
    if (controller) {
      controller.abort();
      runAbortControllers.delete(runId);
    }

    await prisma.blockOutput.updateMany({
      where: { runId, status: { in: ["running", "approved"] } },
      data: { status: "failed" as any, errorMsg: "Stopped by admin" },
    });

    await prisma.workflowRun.update({
      where: { id: runId },
      data: { status: "failed" },
    });

    broadcastToProject(run.projectId, { event: "workflow:stopped", runId });

    return { status: "stopped" };
  });
}

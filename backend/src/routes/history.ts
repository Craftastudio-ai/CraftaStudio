/**
 * History route — retrieves workflow run history per project / user.
 *
 * GET /api/history              — all workflow runs for authenticated user
 * GET /api/history/:projectId   — workflow runs for a specific project
 */
import type { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma'
import { verifyClerk } from '../middleware/clerkAuth'
import { getOrCreateUser } from '../lib/getOrCreateUser'

export async function historyRoutes(app: FastifyInstance) {

  /**
   * GET /api/history?limit=20&offset=0
   * List all workflow runs for the authenticated user, newest first.
   */
  app.get('/', { preHandler: verifyClerk }, async (req: any, reply) => {
    const clerkId = req.user.sub
    const user = await getOrCreateUser(clerkId)

    const { limit: limitStr, offset: offsetStr } = req.query as { limit?: string; offset?: string }
    const limit = Math.min(Math.max(parseInt(limitStr ?? '20', 10) || 20, 1), 100)
    const offset = Math.max(parseInt(offsetStr ?? '0', 10) || 0, 0)

    // Get projects for this user, then get their workflow runs
    const projects = await prisma.project.findMany({
      where: { createdByUserId: user.id },
      select: { id: true, name: true },
    })
    const projectIds = projects.map(p => p.id)

    const [runs, total] = await Promise.all([
      prisma.workflowRun.findMany({
        where: { projectId: { in: projectIds } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          project: { select: { id: true, name: true } },
        },
      }),
      prisma.workflowRun.count({ where: { projectId: { in: projectIds } } }),
    ])

    return {
      runs,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    }
  })

  /**
   * GET /api/history/:projectId
   * All workflow runs for a specific project.
   */
  app.get('/:projectId', { preHandler: verifyClerk }, async (req: any, reply) => {
    const clerkId = req.user.sub
    const user = await getOrCreateUser(clerkId)
    const { projectId } = req.params as { projectId: string }

    // Verify project belongs to user
    const project = await prisma.project.findFirst({
      where: { id: projectId, createdByUserId: user.id },
    })

    if (!project) {
      return reply.code(404).send({ error: 'Project not found' })
    }

    const runs = await prisma.workflowRun.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        blockOutputs: {
          select: { id: true, blockId: true, status: true, createdAt: true },
        },
      },
    })

    return runs
  })
}

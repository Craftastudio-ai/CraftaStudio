// CraftaStudio — src/middleware/teamOwnership.ts
import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify'
import prisma from '../lib/prisma'

/**
 * Middleware — verifies that the authenticated user's team owns the requested project.
 *
 * Expects:
 *  - `req.params.projectId` OR `req.body.projectId` to be present
 *  - `req.headers['x-team-id']` to carry the team ID (set by Clerk JWT middleware upstream)
 *
 * Use as a preHandler hook on project-scoped routes:
 *   app.get('/:projectId/...', { preHandler: [teamOwnership] }, handler)
 *
 * @param req   - Incoming Fastify request
 * @param reply - Reply object for sending 403/404 early responses
 * @param done  - Callback to advance to the route handler
 */
export async function teamOwnership(
  req: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): Promise<void> {
  const teamId = req.headers['x-team-id'] as string | undefined

  if (!teamId) {
    reply.code(401).send({ error: 'Missing x-team-id header — authentication required' })
    return
  }

  const params = req.params as Record<string, string>
  const body   = req.body   as Record<string, unknown> | undefined
  const projectId = params['projectId'] ?? (body?.['projectId'] as string | undefined)

  if (!projectId) {
    // No project context — skip ownership check (some routes may not need it)
    done()
    return
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, teamId },
    select: { id: true },
  })

  if (!project) {
    reply.code(403).send({ error: 'Forbidden — your team does not own this project' })
    return
  }

  done()
}

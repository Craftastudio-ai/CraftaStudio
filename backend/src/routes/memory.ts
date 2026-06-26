/**
 * Memory Layer API Routes
 * Provides endpoints to view, trigger, and delete project memories.
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { verifyClerk } from '../middleware/clerkAuth'
import { getOrCreateUser } from '../lib/getOrCreateUser'
import { processAndStoreMemory } from '../memory/memoryService'
import { getProjectMemories, buildMemoryContext } from '../memory/memoryRetriever'
import prisma from '../lib/prisma'

export async function memoryRoutes(app: FastifyInstance) {

  /** GET /api/memory/:projectId — list all memories for a project */
  app.get('/:projectId', { preHandler: verifyClerk }, async (req: any, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId } = req.params
    const memories = await getProjectMemories(projectId)
    return { projectId, count: memories.length, memories }
  })

  /** GET /api/memory/:projectId/context — get built context ready for injection */
  app.get('/:projectId/context', { preHandler: verifyClerk }, async (req: any, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId } = req.params
    const context = await buildMemoryContext(projectId)
    return { projectId, context }
  })

  /** POST /api/memory/:projectId/learn — manually trigger signal extraction from a prompt */
  app.post('/:projectId/learn', { preHandler: verifyClerk }, async (req: any, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId } = req.params

    const parsed = z.object({ input: z.string().min(1) }).safeParse(req.body)
    if (!parsed.success) return reply.code(422).send({ error: parsed.error.flatten() })

    const signals = await processAndStoreMemory(projectId, parsed.data.input, 'user')

    return reply.code(201).send({
      message: `${signals.length} signals extracted and stored`,
      signals,
    })
  })

  /** DELETE /api/memory/:projectId/:key — delete a specific memory key */
  app.delete('/:projectId/:key', { preHandler: verifyClerk }, async (req: any, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId, key } = req.params

    await prisma.memory.deleteMany({ where: { projectId, key } })
    return reply.code(204).send()
  })

  /** DELETE /api/memory/:projectId — clear all memories for a project */
  app.delete('/:projectId', { preHandler: verifyClerk }, async (req: any, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId } = req.params

    const result = await prisma.memory.deleteMany({ where: { projectId } })
    return { message: `Deleted ${result.count} memories for project ${projectId}` }
  })
}
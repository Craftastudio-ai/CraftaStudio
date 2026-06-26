/**
 * Connections Routes — src/routes/connections.ts
 *
 * Full CRUD for block connections + inference trigger endpoint.
 *
 * Routes:
 *   GET    /api/connections          — list connections for a project
 *   POST   /api/connections          — create a single connection (manual)
 *   DELETE /api/connections/:id      — delete a connection
 *   POST   /api/connections/infer    — run inference engine (batch auto-connect)
 *   POST   /api/connections/infer/dry-run — preview what inference would create
 *   POST   /api/connections/bulk     — create multiple connections in one call
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { pathExists } from '../graph/cycleDetection'
import { verifyClerk } from '../middleware/clerkAuth'
import { getOrCreateUser } from '../lib/getOrCreateUser'
import { emitConnectionCreated, emitConnectionDeleted } from '../graph/graphEvents'
import { inferConnections } from '../graph/connectionInference'

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

const CreateConnectionSchema = z.object({
  projectId:      z.string().uuid(),
  fromBlockId:    z.string().uuid(),
  toBlockId:      z.string().uuid(),
  connectionType: z.enum(['dependency', 'data_flow', 'trigger']).default('dependency'),
})

const BulkConnectionSchema = z.object({
  projectId:   z.string().uuid(),
  connections: z.array(z.object({
    fromBlockId:    z.string().uuid(),
    toBlockId:      z.string().uuid(),
    connectionType: z.enum(['dependency', 'data_flow', 'trigger']).default('dependency'),
  })).min(1).max(100),
})

const InferSchema = z.object({
  projectId:           z.string().uuid(),
  confidenceThreshold: z.number().min(0).max(1).default(0.60),
})

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

export async function connectionsRoutes(app: FastifyInstance) {

  // ── GET connections ────────────────────────────────────────────────────

  app.get('/', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)

    const { projectId } = req.query as { projectId?: string }
    if (!projectId) return reply.code(400).send({ error: 'projectId required' })

    const connections = await prisma.connection.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    })

    return reply.send(connections)
  })

  // ── POST connection (single, manual) ──────────────────────────────────

  app.post('/', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    const clerkId = req.user.sub
    await getOrCreateUser(clerkId)

    const parsed = CreateConnectionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(422).send({ error: parsed.error.flatten() })

    const { projectId, fromBlockId, toBlockId, connectionType } = parsed.data

    // 1. Validate both blocks exist and belong to the project
    const [fromBlock, toBlock] = await Promise.all([
      prisma.block.findFirst({ where: { id: fromBlockId, projectId, deletedAt: null }, select: { id: true } }),
      prisma.block.findFirst({ where: { id: toBlockId,   projectId, deletedAt: null }, select: { id: true } }),
    ])

    if (!fromBlock) return reply.code(404).send({ error: `fromBlockId ${fromBlockId} not found in project` })
    if (!toBlock)   return reply.code(404).send({ error: `toBlockId ${toBlockId} not found in project` })
    if (fromBlockId === toBlockId) return reply.code(422).send({ error: 'Self-loops are not allowed' })

    // 2. Cycle detection
    const wouldCycle = await pathExists(projectId, fromBlockId, toBlockId)
    if (wouldCycle) {
      return reply.code(409).send({ error: 'Cycle detected: this connection would create a circular dependency' })
    }

    // 3. Persist
    try {
      const connection = await prisma.connection.create({
        data: { projectId, fromBlockId, toBlockId, connectionType },
      })

      emitConnectionCreated(projectId, fromBlockId, toBlockId, clerkId).catch(
        err => console.error('[connections] emitConnectionCreated failed:', err)
      )

      return reply.code(201).send(connection)
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'P2002') return reply.code(409).send({ error: 'Connection already exists' })
      throw err
    }
  })

  // ── POST /bulk — create multiple connections atomically ───────────────

  app.post('/bulk', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    const clerkId = req.user.sub
    await getOrCreateUser(clerkId)

    const parsed = BulkConnectionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(422).send({ error: parsed.error.flatten() })

    const { projectId, connections } = parsed.data

    const results = {
      created:         [] as string[],
      skipped:         [] as { fromBlockId: string; toBlockId: string; reason: string }[],
      cyclesPrevented: [] as { fromBlockId: string; toBlockId: string }[],
    }

    for (const conn of connections) {
      const { fromBlockId, toBlockId, connectionType } = conn

      // Self-loop guard
      if (fromBlockId === toBlockId) {
        results.skipped.push({ fromBlockId, toBlockId, reason: 'self-loop' })
        continue
      }

      // Cycle guard
      const wouldCycle = await pathExists(projectId, fromBlockId, toBlockId)
      if (wouldCycle) {
        results.cyclesPrevented.push({ fromBlockId, toBlockId })
        continue
      }

      try {
        const created = await prisma.connection.create({
          data: { projectId, fromBlockId, toBlockId, connectionType },
        })
        results.created.push(created.id)
        emitConnectionCreated(projectId, fromBlockId, toBlockId, clerkId).catch(err =>
          console.error('[connections/bulk] emitConnectionCreated failed:', err)
        )
      } catch (err: unknown) {
        const code = (err as { code?: string }).code
        if (code === 'P2002') {
          results.skipped.push({ fromBlockId, toBlockId, reason: 'already exists' })
        } else {
          results.skipped.push({ fromBlockId, toBlockId, reason: 'db error' })
          console.error('[connections/bulk] create failed:', err)
        }
      }
    }

    return reply.code(201).send({
      projectId,
      summary: {
        totalRequested:  connections.length,
        created:         results.created.length,
        skipped:         results.skipped.length,
        cyclesPrevented: results.cyclesPrevented.length,
      },
      ...results,
    })
  })

  // ── POST /infer — run inference engine ───────────────────────────────

  app.post('/infer', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    const clerkId = req.user.sub
    await getOrCreateUser(clerkId)

    const parsed = InferSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(422).send({ error: parsed.error.flatten() })

    const { projectId, confidenceThreshold } = parsed.data

    const result = await inferConnections(projectId, clerkId, confidenceThreshold, false)

    return reply.code(201).send({
      projectId,
      summary: {
        candidatesEvaluated: result.inferred.length,
        created:             result.created,
        skipped:             result.skipped,
        cyclesPrevented:     result.cyclesPrevented,
        durationMs:          result.durationMs,
      },
      connections: result.inferred.map(c => ({
        fromBlockId:    c.fromBlockId,
        toBlockId:      c.toBlockId,
        connectionType: c.connectionType,
        confidence:     c.confidence,
        rule:           c.rule,
        reason:         c.reason,
      })),
    })
  })

  // ── POST /infer/dry-run — preview without persisting ─────────────────

  app.post('/infer/dry-run', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    const clerkId = req.user.sub
    await getOrCreateUser(clerkId)

    const parsed = InferSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(422).send({ error: parsed.error.flatten() })

    const { projectId, confidenceThreshold } = parsed.data

    const result = await inferConnections(projectId, clerkId, confidenceThreshold, true)

    return reply.send({
      projectId,
      dryRun: true,
      wouldCreate: result.inferred.length,
      connections: result.inferred.map(c => ({
        fromBlockId:    c.fromBlockId,
        toBlockId:      c.toBlockId,
        connectionType: c.connectionType,
        confidence:     c.confidence,
        rule:           c.rule,
        reason:         c.reason,
      })),
    })
  })

  // ── DELETE connection ─────────────────────────────────────────────────

  app.delete('/:id', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    const clerkId = req.user.sub
    await getOrCreateUser(clerkId)

    const { id } = req.params as { id: string }

    const conn = await prisma.connection.findUnique({
      where: { id },
      select: { projectId: true, fromBlockId: true, toBlockId: true },
    })

    if (!conn) return reply.code(404).send({ error: 'Connection not found' })

    await prisma.connection.delete({ where: { id } })

    emitConnectionDeleted(conn.projectId, conn.fromBlockId, conn.toBlockId, clerkId).catch(
      err => console.error('[connections] emitConnectionDeleted failed:', err)
    )

    return reply.code(204).send()
  })
}
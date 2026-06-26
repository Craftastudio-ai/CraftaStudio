/**
 * Graph Routes — src/routes/graph.ts
 *
 * Full HTTP API for Graphify Engine + Graph Reasoning AI.
 *
 * Graph APIs:
 *   GET  /api/graph/:projectId              — full graph summary
 *   GET  /api/graph/:projectId/reload       — force reload from DB
 *
 * Traversal APIs:
 *   GET  /api/graph/:projectId/affected/:blockId    — downstream BFS
 *   GET  /api/graph/:projectId/upstream/:blockId    — reverse BFS
 *   GET  /api/graph/:projectId/downstream/:blockId  — direct dependents
 *   GET  /api/graph/:projectId/cycles               — cycle detection
 *   POST /api/graph/:projectId/subgraph             — partial graph extraction
 *
 * Analysis APIs:
 *   GET  /api/graph/:projectId/topo         — topological sort
 *   GET  /api/graph/:projectId/depth        — depth map
 *   GET  /api/graph/:projectId/scc          — strongly connected components
 *
 * Snapshot APIs:
 *   POST /api/graph/:projectId/snapshot     — create snapshot
 *   GET  /api/graph/:projectId/snapshots    — list snapshots
 *   GET  /api/graph/:projectId/snapshots/:version — get specific snapshot
 *
 * Reasoning APIs:
 *   POST /api/graph/:projectId/reason       — run reasoning pipeline
 *   GET  /api/graph/:projectId/reason/:mode/:blockId — get cached result
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { verifyClerk } from '../middleware/clerkAuth'
import { getOrCreateUser } from '../lib/getOrCreateUser'
import { graphRegistry } from '../graph/graphEngine'
import { runReasoning, classifyMode, type ReasoningMode } from '../graph/graphReasoning'

// ─────────────────────────────────────────────────────────────────────────────

const SubgraphSchema = z.object({
  blockIds: z.array(z.string().uuid()).min(1).max(50),
})

const ReasoningSchema = z.object({
  mode: z.enum([
    'impact_analysis',
    'root_cause_analysis',
    'optimization',
    'simulation',
    'conflict_resolution',
  ]).optional(),
  blockId: z.string().uuid().optional(),
  userContext: z.string().max(2000).optional(),
  simulationChange: z.object({
    action: z.enum(['add_block', 'remove_block', 'add_connection', 'remove_connection']),
    from: z.string().uuid().optional(),
    to: z.string().uuid().optional(),
    blockType: z.string().optional(),
  }).optional(),
  conflictId: z.string().uuid().optional(),
})

// ─────────────────────────────────────────────────────────────────────────────

export async function graphRoutes(app: FastifyInstance) {

  // ── Graph Info ──────────────────────────────────────────────────────────

  /** GET /api/graph/:projectId — full graph summary */
  app.get('/:projectId', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId } = req.params as { projectId: string }

    const engine = await graphRegistry.get(projectId)

    return reply.send({
      projectId,
      nodeCount: engine.nodeCount(),
      edgeCount: engine.edgeCount(),
      nodes: engine.getAllNodes(),
      edges: engine.getAllEdges(),
      depthMap: engine.getDepthMap(),
      hasCycles: engine.detectCycles(),
      loadedAt: new Date().toISOString(),
    })
  })

  /** GET /api/graph/:projectId/reload — force reload from DB */
  app.get('/:projectId/reload', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId } = req.params as { projectId: string }

    const engine = await graphRegistry.reload(projectId)
    console.log(`[graph] Force reloaded project=${projectId}`)

    return reply.send({
      status: 'reloaded',
      projectId,
      nodeCount: engine.nodeCount(),
      edgeCount: engine.edgeCount(),
    })
  })

  // ── Traversal APIs ──────────────────────────────────────────────────────

  /** GET /api/graph/:projectId/affected/:blockId */
  app.get('/:projectId/affected/:blockId', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId, blockId } = req.params as { projectId: string; blockId: string }

    const engine = await graphRegistry.get(projectId)
    const affected = engine.getAffectedBlocks(blockId)
    const depthMap = engine.getDepthMap()

    return reply.send({
      blockId,
      affectedCount: affected.length,
      affectedBlocks: affected,
      maxDepth: affected.length > 0 ? Math.max(...affected.map(id => depthMap[id] ?? 0)) : 0,
    })
  })

  /** GET /api/graph/:projectId/upstream/:blockId */
  app.get('/:projectId/upstream/:blockId', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId, blockId } = req.params as { projectId: string; blockId: string }

    const engine = await graphRegistry.get(projectId)
    const upstream = engine.getUpstream(blockId)

    return reply.send({ blockId, upstreamCount: upstream.length, upstreamBlocks: upstream })
  })

  /** GET /api/graph/:projectId/downstream/:blockId */
  app.get('/:projectId/downstream/:blockId', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId, blockId } = req.params as { projectId: string; blockId: string }

    const engine = await graphRegistry.get(projectId)
    const downstream = engine.getDownstream(blockId)

    return reply.send({ blockId, directDependentCount: downstream.length, directDependents: downstream })
  })

  /** GET /api/graph/:projectId/cycles */
  app.get('/:projectId/cycles', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId } = req.params as { projectId: string }

    const engine = await graphRegistry.get(projectId)
    const hasCycles = engine.detectCycles()
    const scc = hasCycles ? engine.getSCCs() : null

    return reply.send({
      projectId,
      hasCycles,
      cyclicGroups: scc?.cyclicGroups ?? [],
    })
  })

  /** POST /api/graph/:projectId/subgraph */
  app.post('/:projectId/subgraph', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId } = req.params as { projectId: string }

    const parsed = SubgraphSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(422).send({ error: parsed.error.flatten() })

    const engine = await graphRegistry.get(projectId)
    const subgraph = engine.getSubgraph(parsed.data.blockIds)

    return reply.send({ projectId, blockIds: parsed.data.blockIds, subgraph })
  })

  // ── Analysis APIs ───────────────────────────────────────────────────────

  /** GET /api/graph/:projectId/topo */
  app.get('/:projectId/topo', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId } = req.params as { projectId: string }

    try {
      const engine = await graphRegistry.get(projectId)
      const order = engine.topologicalSort()
      return reply.send({ projectId, generationOrder: order, blockCount: order.length })
    } catch (err: unknown) {
      return reply.code(409).send({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  /** GET /api/graph/:projectId/depth */
  app.get('/:projectId/depth', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId } = req.params as { projectId: string }

    const engine = await graphRegistry.get(projectId)
    const depthMap = engine.getDepthMap()
    const maxDepth = Object.values(depthMap).length > 0 ? Math.max(...Object.values(depthMap)) : 0

    return reply.send({ projectId, depthMap, maxDepth })
  })

  /** GET /api/graph/:projectId/scc */
  app.get('/:projectId/scc', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId } = req.params as { projectId: string }

    const engine = await graphRegistry.get(projectId)
    const result = engine.getSCCs()

    return reply.send({
      projectId,
      hasCycles: result.hasCycles,
      componentCount: result.components.length,
      cyclicGroups: result.cyclicGroups,
      allComponents: result.components,
    })
  })

  // ── Snapshot APIs ───────────────────────────────────────────────────────

  /** POST /api/graph/:projectId/snapshot */
  app.post('/:projectId/snapshot', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    const user = await getOrCreateUser(req.user.sub)
    const { projectId } = req.params as { projectId: string }

    const engine = await graphRegistry.get(projectId)
    const snapshotData = engine.snapshot()

    // Version: timestamp-based
    const version = `v${Date.now()}`

    const snapshot = await prisma.graphSnapshot.create({
      data: {
        projectId,
        version,
        graphJson: snapshotData as unknown as import("@prisma/client").Prisma.InputJsonObject,
        triggeredBy: user.id,
      },
    })

    console.log(`[graph] Snapshot created project=${projectId} version=${version}`)

    return reply.code(201).send({
      id: snapshot.id,
      projectId,
      version,
      nodeCount: Object.keys(snapshotData.nodes).length,
      edgeCount: snapshotData.edges.length,
      createdAt: snapshot.createdAt,
    })
  })

  /** GET /api/graph/:projectId/snapshots */
  app.get('/:projectId/snapshots', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId } = req.params as { projectId: string }

    const snapshots = await prisma.graphSnapshot.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, version: true, triggeredBy: true, createdAt: true },
    })

    return reply.send({ projectId, snapshots })
  })

  /** GET /api/graph/:projectId/snapshots/:version */
  app.get('/:projectId/snapshots/:version', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId, version } = req.params as { projectId: string; version: string }

    const snapshot = await prisma.graphSnapshot.findUnique({
      where: { projectId_version: { projectId, version } },
    })

    if (!snapshot) return reply.code(404).send({ error: 'Snapshot not found' })

    return reply.send(snapshot)
  })

  // ── Reasoning APIs ──────────────────────────────────────────────────────

  /** POST /api/graph/:projectId/reason */
  app.post('/:projectId/reason', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId } = req.params as { projectId: string }

    const parsed = ReasoningSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(422).send({ error: parsed.error.flatten() })

    const mode = classifyMode({ ...parsed.data, mode: parsed.data.mode as ReasoningMode | undefined })

    const result = await runReasoning({
      projectId,
      mode,
      blockId: parsed.data.blockId,
      userContext: parsed.data.userContext,
      simulationChange: parsed.data.simulationChange,
      conflictId: parsed.data.conflictId,
    })

    return reply.send(result)
  })

  /** GET /api/graph/:projectId/reason/cached/:mode/:blockId */
  app.get('/:projectId/reason/cached/:mode/:blockId', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId, mode, blockId } = req.params as {
      projectId: string
      mode: string
      blockId: string
    }

    const cached = await prisma.reasoningResult.findFirst({
      where: {
        projectId,
        mode: mode as ReasoningMode,
        blockId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!cached) return reply.code(404).send({ error: 'No cached result found' })
    return reply.send({ ...(cached.result as Record<string, unknown>), cachedAt: cached.createdAt })
  })

  /** GET /api/graph/:projectId/events — recent event log */
  app.get('/:projectId/events', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId } = req.params as { projectId: string }
    const { limit = 50 } = req.query as { limit?: number }

    const events = await prisma.eventLog.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    })

    return reply.send({ projectId, events })
  })
}
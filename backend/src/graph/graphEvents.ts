/**
 * Graph Events — src/graph/graphEvents.ts
 *
 * Every structural change (block created/deleted, connection added/removed)
 * fires through here. This module:
 *   1. Patches the in-memory GraphEngine (never triggers a full rebuild)
 *   2. Logs the event to EventLog table
 *   3. Persists updated depthLevel + affectedCount back to the DB
 *   4. Invalidates relevant caches
 */

import prisma from '../lib/prisma'
import { graphRegistry, GraphEngine } from './graphEngine'
import type { EventType } from '@prisma/client'

// ── Event Emission ────────────────────────────────────────────────────────────

export async function emitBlockCreated(
  projectId: string,
  blockId: string,
  blockType: string,
  triggeredBy?: string,
): Promise<void> {
  const engine = await graphRegistry.get(projectId)
  engine.addNode(blockId, blockType)

  await logEvent(projectId, 'BLOCK_CREATED', { blockId, blockType }, triggeredBy)
  await syncDepthsToDB(projectId, engine)
}

export async function emitBlockDeleted(
  projectId: string,
  blockId: string,
  triggeredBy?: string,
): Promise<void> {
  const engine = await graphRegistry.get(projectId)
  engine.removeNode(blockId)

  await logEvent(projectId, 'BLOCK_DELETED', { blockId }, triggeredBy)
  await syncDepthsToDB(projectId, engine)
}

export async function emitBlockGenerated(
  projectId: string,
  blockId: string,
  runId: string,
  triggeredBy?: string,
): Promise<void> {
  await logEvent(projectId, 'BLOCK_GENERATED', { blockId, runId }, triggeredBy)
}

export async function emitConnectionCreated(
  projectId: string,
  fromBlockId: string,
  toBlockId: string,
  triggeredBy?: string,
): Promise<void> {
  const engine = await graphRegistry.get(projectId)
  engine.addEdge(fromBlockId, toBlockId)

  await logEvent(projectId, 'CONNECTION_CREATED', { fromBlockId, toBlockId }, triggeredBy)
  await syncDepthsToDB(projectId, engine)
  await updateSubgraphCache(projectId, fromBlockId, engine)
}

export async function emitConnectionDeleted(
  projectId: string,
  fromBlockId: string,
  toBlockId: string,
  triggeredBy?: string,
): Promise<void> {
  const engine = await graphRegistry.get(projectId)
  engine.removeEdge(fromBlockId, toBlockId)

  await logEvent(projectId, 'CONNECTION_DELETED', { fromBlockId, toBlockId }, triggeredBy)
  await syncDepthsToDB(projectId, engine)
}

export async function emitWorkflowStarted(
  projectId: string,
  runId: string,
  triggeredBy?: string,
): Promise<void> {
  await logEvent(projectId, 'WORKFLOW_STARTED', { runId }, triggeredBy)
}

export async function emitWorkflowCompleted(
  projectId: string,
  runId: string,
  triggeredBy?: string,
): Promise<void> {
  await logEvent(projectId, 'WORKFLOW_COMPLETED', { runId }, triggeredBy)
}

export async function emitConflictDetected(
  projectId: string,
  conflictId: string,
  blockId?: string,
): Promise<void> {
  await logEvent(projectId, 'CONFLICT_DETECTED', { conflictId, blockId })
}

// ── DB Sync Helpers ───────────────────────────────────────────────────────────

/**
 * Write updated depthLevel and affectedCount back to the blocks table.
 * Called after every structural change so the DB stays in sync with the graph.
 */
async function syncDepthsToDB(
  projectId: string,
  engine: GraphEngine,
): Promise<void> {
  const nodes = engine.getAllNodes()
  if (nodes.length === 0) return

  // Batch update using Promise.all — avoid N+1
  await Promise.all(
    nodes.map(node =>
      prisma.block.updateMany({
        where: { id: node.id, projectId },
        data: {
          depthLevel: node.depthLevel,
          affectedCount: node.affectedCount,
        },
      })
    )
  ).catch(err => console.error('[graphEvents] syncDepthsToDB failed:', err))
}

/**
 * Update the SubgraphCache for a specific block after a structural change.
 */
async function updateSubgraphCache(
  projectId: string,
  blockId: string,
  engine: GraphEngine,
): Promise<void> {
  try {
    const affected = engine.getAffectedBlocks(blockId)
    const subgraph = engine.getSubgraph([blockId, ...affected])
    const node = engine.getNode(blockId)

    await prisma.subgraphCache.upsert({
      where: { blockId },
      create: {
        projectId,
        blockId,
        subgraphJson: subgraph as unknown as import("@prisma/client").Prisma.InputJsonObject,
        depthLevel: node?.depthLevel ?? 0,
        affectedIds: affected,
      },
      update: {
        subgraphJson: subgraph as unknown as import("@prisma/client").Prisma.InputJsonObject,
        depthLevel: node?.depthLevel ?? 0,
        affectedIds: affected,
        computedAt: new Date(),
      },
    })
  } catch (err) {
    console.error('[graphEvents] updateSubgraphCache failed:', err)
  }
}

async function logEvent(
  projectId: string,
  eventType: EventType,
  payload: Record<string, unknown>,
  triggeredBy?: string,
): Promise<void> {
  try {
    await prisma.eventLog.create({
      data: {
        projectId,
        eventType,
        payload: payload as unknown as import("@prisma/client").Prisma.InputJsonObject,
        triggeredBy,
        processed: false,
      },
    })
  } catch (err) {
    console.error(`[graphEvents] Failed to log event ${eventType}:`, err)
  }
}
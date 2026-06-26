/**
 * Cascade Regeneration — src/graph/cascadeRegen.ts
 *
 * When block chat triggers a `regenerate_block` action, this module:
 *   1. Builds the dependency graph for all blocks in the project
 *   2. Finds all transitive downstream blocks (i.e. blocks that depend on
 *      the regenerated block, directly or indirectly)
 *   3. Returns them in topological generation order (dependencies first)
 *
 * The triggering block itself is NEVER included in the result.
 * Cycle detection is baked in via Kahn's algorithm.
 */

import prisma from '../lib/prisma'

export interface CascadeResult {
  /** All block IDs that are downstream of the triggered block */
  affectedIds: string[]
  /** affectedIds sorted in safe generation order (dependencies first) */
  orderedIds: string[]
}

/**
 * Find all downstream blocks that must be regenerated after `triggeredBlockId`
 * is regenerated. Returns them in topological order (safe to enqueue in sequence).
 *
 * @param projectId        The project that owns all blocks
 * @param triggeredBlockId The block that was just regenerated via chat
 */
export async function findDownstreamCascade(
  projectId: string,
  triggeredBlockId: string,
): Promise<CascadeResult> {

  // ── 1. Load all blocks + connections from DB ────────────────────────────
  const [allBlocks, allConnections] = await Promise.all([
    prisma.block.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true },
    }),
    prisma.connection.findMany({
      where: { projectId, deletedAt: null },
      select: { fromBlockId: true, toBlockId: true },
    }),
  ])

  // ── 2. Build forward adjacency list (from → [to, to, …]) ────────────────
  const adj = new Map<string, Set<string>>()
  for (const b of allBlocks) {
    adj.set(b.id, new Set())
  }
  for (const c of allConnections) {
    adj.get(c.fromBlockId)?.add(c.toBlockId)
  }

  // ── 3. BFS from triggeredBlockId to collect all transitive downstream ────
  const downstream = new Set<string>()
  const queue: string[] = [triggeredBlockId]
  const visited = new Set<string>([triggeredBlockId])

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const neighbour of adj.get(current) ?? []) {
      if (!visited.has(neighbour)) {
        visited.add(neighbour)
        // Do NOT include the triggering block itself
        if (neighbour !== triggeredBlockId) {
          downstream.add(neighbour)
          queue.push(neighbour)
        }
      }
    }
  }

  const affectedIds = Array.from(downstream)

  if (affectedIds.length === 0) {
    return { affectedIds: [], orderedIds: [] }
  }

  // ── 4. Topological sort over the affected sub-graph only ─────────────────
  //   We also need to include the triggeredBlockId as a "source" so that edges
  //   from it into the downstream set reduce in-degree correctly.
  const subgraphIds = new Set([triggeredBlockId, ...affectedIds])

  const inDegree = new Map<string, number>()
  for (const id of subgraphIds) inDegree.set(id, 0)

  for (const from of subgraphIds) {
    for (const to of adj.get(from) ?? []) {
      if (subgraphIds.has(to)) {
        inDegree.set(to, (inDegree.get(to) ?? 0) + 1)
      }
    }
  }

  // Seed the queue with nodes that have in-degree 0 within the sub-graph.
  // The triggeredBlockId should be one of them (it has no upstream in this sub-graph).
  const topoQueue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) topoQueue.push(id)
  }

  const sorted: string[] = []
  while (topoQueue.length > 0) {
    const current = topoQueue.shift()!
    sorted.push(current)
    for (const neighbour of adj.get(current) ?? []) {
      if (!subgraphIds.has(neighbour)) continue
      const newDeg = (inDegree.get(neighbour) ?? 1) - 1
      inDegree.set(neighbour, newDeg)
      if (newDeg === 0) topoQueue.push(neighbour)
    }
  }

  // Remove the triggering block from the ordered list — we only re-queue downstreams
  const orderedIds = sorted.filter(id => id !== triggeredBlockId)

  console.log(
    `[cascade] Project=${projectId} triggered=${triggeredBlockId} ` +
    `affected=${affectedIds.length} orderedIds=[${orderedIds.join(', ')}]`
  )

  return { affectedIds, orderedIds }
}

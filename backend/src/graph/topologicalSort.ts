// CraftaStudio — src/graph/topologicalSort.ts
import prisma from '../lib/prisma'

/**
 * Kahn's Algorithm — returns a topological ordering of all blocks in a project.
 *
 * The topological order determines the correct sequence for AI code generation:
 * a Block may only be generated AFTER all blocks it depends on have been generated.
 *
 * If a cycle is detected (in-degree never reaches 0 for some nodes),
 * an error is thrown — the graph must be a DAG before a WorkflowRun can start.
 *
 * @param projectId - UUID of the project
 * @returns         - Ordered array of block IDs (safe generation order)
 * @throws          - Error if the block graph contains a cycle
 */
export async function topologicalSort(projectId: string): Promise<string[]> {
  const [blocks, connections] = await Promise.all([
    prisma.block.findMany({ where: { projectId }, select: { id: true } }),
    prisma.connection.findMany({
      where: { projectId },
      select: { fromBlockId: true, toBlockId: true },
    }),
  ])

  const allIds = new Set(blocks.map((b) => b.id))

  // Build in-degree map and adjacency list
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const id of allIds) {
    inDegree.set(id, 0)
    adjacency.set(id, [])
  }

  for (const conn of connections) {
    inDegree.set(conn.toBlockId, (inDegree.get(conn.toBlockId) ?? 0) + 1)
    const neighbours = adjacency.get(conn.fromBlockId) ?? []
    neighbours.push(conn.toBlockId)
    adjacency.set(conn.fromBlockId, neighbours)
  }

  // Queue starts with all nodes that have no dependencies
  const queue: string[] = []
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id)
  }

  const sorted: string[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    sorted.push(current)

    const neighbours = adjacency.get(current) ?? []
    for (const neighbour of neighbours) {
      const newDeg = (inDegree.get(neighbour) ?? 1) - 1
      inDegree.set(neighbour, newDeg)
      if (newDeg === 0) queue.push(neighbour)
    }
  }

  if (sorted.length !== allIds.size) {
    throw new Error(
      `Cycle detected in project ${projectId} — cannot produce a topological sort. ` +
      `${allIds.size - sorted.length} block(s) are part of a cycle.`,
    )
  }

  return sorted
}

// CraftaStudio — src/graph/traversal.ts
import prisma from '../lib/prisma'

/**
 * BFS — returns all block IDs that are affected (directly or transitively)
 * when a given block changes.
 *
 * Used before a partial re-run to know which downstream blocks must be
 * re-generated even if they were not directly edited.
 *
 * @param projectId  - UUID of the project
 * @param blockId    - ID of the changed block (BFS origin)
 * @returns          - Ordered list of affected block IDs (BFS order, origin excluded)
 */
export async function getAffectedBlocks(
  projectId: string,
  blockId: string,
): Promise<string[]> {
  // Fetch all connections for the project once — avoids N+1
  const connections = await prisma.connection.findMany({
    where: { projectId },
    select: { fromBlockId: true, toBlockId: true },
  })

  // Build adjacency map: fromBlockId → [toBlockId, ...]
  const adjacency = new Map<string, string[]>()
  for (const conn of connections) {
    const neighbours = adjacency.get(conn.fromBlockId) ?? []
    neighbours.push(conn.toBlockId)
    adjacency.set(conn.fromBlockId, neighbours)
  }

  // BFS from the changed block
  const visited = new Set<string>([blockId])
  const queue: string[] = [blockId]
  const affected: string[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    const neighbours = adjacency.get(current) ?? []

    for (const neighbour of neighbours) {
      if (!visited.has(neighbour)) {
        visited.add(neighbour)
        affected.push(neighbour)
        queue.push(neighbour)
      }
    }
  }

  return affected
}

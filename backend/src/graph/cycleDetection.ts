// CraftaStudio — src/graph/cycleDetection.ts
import prisma from '../lib/prisma'

/**
 * DFS — checks whether a path already exists from `sourceId` to `targetId`.
 *
 * Used BEFORE creating a new connection to prevent cycles in the block graph.
 * If `pathExists(from, to)` returns true, adding the edge `(to → from)` would
 * create a cycle, so the operation must be rejected.
 *
 * @param projectId - UUID of the project (scopes the edge lookup)
 * @param sourceId  - Block ID to start DFS from
 * @param targetId  - Block ID to search for
 * @returns         - `true` if a directed path source → … → target exists
 */
export async function pathExists(
  projectId: string,
  sourceId: string,
  targetId: string,
): Promise<boolean> {
  const connections = await prisma.connection.findMany({
    where: { projectId },
    select: { fromBlockId: true, toBlockId: true },
  })

  const adjacency = new Map<string, string[]>()
  for (const conn of connections) {
    const neighbours = adjacency.get(conn.fromBlockId) ?? []
    neighbours.push(conn.toBlockId)
    adjacency.set(conn.fromBlockId, neighbours)
  }

  // Iterative DFS
  const visited = new Set<string>()
  const stack: string[] = [sourceId]

  while (stack.length > 0) {
    const current = stack.pop()!

    if (current === targetId) return true
    if (visited.has(current)) continue

    visited.add(current)

    const neighbours = adjacency.get(current) ?? []
    for (const neighbour of neighbours) {
      if (!visited.has(neighbour)) {
        stack.push(neighbour)
      }
    }
  }

  return false
}

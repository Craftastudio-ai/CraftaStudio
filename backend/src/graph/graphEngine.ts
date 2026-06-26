/**
 * Graphify Engine — src/graph/graphEngine.ts
 *
 * The in-memory graph layer over the Block Graph.
 * Loaded from DB at startup, patched incrementally on every structural event.
 *
 * Exports:
 *  - GraphEngine class (singleton per project)
 *  - graphRegistry — project-keyed map of live GraphEngine instances
 */

import prisma from '../lib/prisma'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string
  blockType: string
  depthLevel: number
  affectedCount: number
}

export interface GraphEdge {
  from: string
  to: string
  type: string
}

export interface SubgraphResult {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface SCCResult {
  components: string[][]
  hasCycles: boolean
  cyclicGroups: string[][]
}

export interface SnapshotData {
  nodes: Record<string, GraphNode>
  edges: GraphEdge[]
  depthMap: Record<string, number>
  generatedAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// GraphEngine
// ─────────────────────────────────────────────────────────────────────────────

export class GraphEngine {
  projectId: string
  private nodes: Map<string, GraphNode> = new Map()
  private adj: Map<string, Set<string>> = new Map()      // forward edges
  private radj: Map<string, Set<string>> = new Map()     // reverse edges
  private depthMap: Map<string, number> = new Map()
  private topoCache: string[] | null = null
  private subgraphCache: Map<string, { result: SubgraphResult; expiresAt: number }> = new Map()
  private lastEventAt = 0
  private loadedAt = 0

  constructor(projectId: string) {
    this.projectId = projectId
  }

  // ── Build from DB ───────────────────────────────────────────────────────

  async loadFromDB(): Promise<void> {
    const [blocks, connections] = await Promise.all([
      prisma.block.findMany({
        where: { projectId: this.projectId, deletedAt: null },
        select: { id: true, blockType: true, depthLevel: true, affectedCount: true },
      }),
      prisma.connection.findMany({
        where: { projectId: this.projectId, deletedAt: null },
        select: { fromBlockId: true, toBlockId: true, connectionType: true },
      }),
    ])

    this.nodes.clear()
    this.adj.clear()
    this.radj.clear()

    for (const b of blocks) {
      this.nodes.set(b.id, {
        id: b.id,
        blockType: b.blockType,
        depthLevel: b.depthLevel ?? 0,
        affectedCount: b.affectedCount ?? 0,
      })
      this.adj.set(b.id, new Set())
      this.radj.set(b.id, new Set())
    }

    for (const c of connections) {
      this.adj.get(c.fromBlockId)?.add(c.toBlockId)
      this.radj.get(c.toBlockId)?.add(c.fromBlockId)
    }

    this.recomputeDepths()
    this.topoCache = null
    this.loadedAt = Date.now()
    console.log(`[graphify] Loaded project=${this.projectId} nodes=${this.nodes.size} edges=${connections.length}`)
  }

  // ── Incremental Updates ─────────────────────────────────────────────────

  addNode(id: string, blockType: string): void {
    this.nodes.set(id, { id, blockType, depthLevel: 0, affectedCount: 0 })
    this.adj.set(id, new Set())
    this.radj.set(id, new Set())
    this.invalidateCaches()
  }

  removeNode(id: string): void {
    // Remove all edges involving this node
    const outNeighbours = this.adj.get(id) ?? new Set()
    for (const to of outNeighbours) {
      this.radj.get(to)?.delete(id)
    }
    const inNeighbours = this.radj.get(id) ?? new Set()
    for (const from of inNeighbours) {
      this.adj.get(from)?.delete(id)
    }
    this.nodes.delete(id)
    this.adj.delete(id)
    this.radj.delete(id)
    this.invalidateCaches()
  }

  addEdge(from: string, to: string): void {
    if (!this.adj.has(from)) this.adj.set(from, new Set())
    if (!this.radj.has(to)) this.radj.set(to, new Set())
    this.adj.get(from)!.add(to)
    this.radj.get(to)!.add(from)
    this.recomputeDepths()
    this.invalidateCaches()
  }

  removeEdge(from: string, to: string): void {
    this.adj.get(from)?.delete(to)
    this.radj.get(to)?.delete(from)
    this.recomputeDepths()
    this.invalidateCaches()
  }

  // ── Core Traversal APIs ─────────────────────────────────────────────────

  /** 4.1 getAffectedBlocks — downstream BFS (transitive closure) */
  getAffectedBlocks(blockId: string): string[] {
    const visited = new Set<string>([blockId])
    const queue = [blockId]
    const affected: string[] = []

    while (queue.length > 0) {
      const current = queue.shift()!
      for (const neighbour of this.adj.get(current) ?? []) {
        if (!visited.has(neighbour)) {
          visited.add(neighbour)
          affected.push(neighbour)
          queue.push(neighbour)
        }
      }
    }
    return affected
  }

  /** 4.2 getUpstream — reverse BFS (all ancestors) */
  getUpstream(blockId: string): string[] {
    const visited = new Set<string>([blockId])
    const queue = [blockId]
    const upstream: string[] = []

    while (queue.length > 0) {
      const current = queue.shift()!
      for (const parent of this.radj.get(current) ?? []) {
        if (!visited.has(parent)) {
          visited.add(parent)
          upstream.push(parent)
          queue.push(parent)
        }
      }
    }
    return upstream
  }

  /** 4.3 getDownstream — direct dependents only (immediate neighbours) */
  getDownstream(blockId: string): string[] {
    return Array.from(this.adj.get(blockId) ?? [])
  }

  /** 4.4 detectCycles — DFS with recursion stack */
  detectCycles(): boolean {
    const visited = new Set<string>()
    const recStack = new Set<string>()

    const dfs = (node: string): boolean => {
      visited.add(node)
      recStack.add(node)
      for (const neighbour of this.adj.get(node) ?? []) {
        if (!visited.has(neighbour)) {
          if (dfs(neighbour)) return true
        } else if (recStack.has(neighbour)) {
          return true
        }
      }
      recStack.delete(node)
      return false
    }

    for (const id of this.nodes.keys()) {
      if (!visited.has(id)) {
        if (dfs(id)) return true
      }
    }
    return false
  }

  /** 4.5 getSubgraph — partial graph for the specified block IDs */
  getSubgraph(blockIds: string[]): SubgraphResult {
    const cacheKey = [...blockIds].sort().join(',')
    const cached = this.subgraphCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return cached.result

    const idSet = new Set(blockIds)
    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []

    for (const id of idSet) {
      const node = this.nodes.get(id)
      if (node) nodes.push(node)
    }

    for (const from of idSet) {
      for (const to of this.adj.get(from) ?? []) {
        if (idSet.has(to)) {
          edges.push({ from, to, type: 'dependency' })
        }
      }
    }

    const result: SubgraphResult = { nodes, edges }
    this.subgraphCache.set(cacheKey, { result, expiresAt: Date.now() + 30_000 })
    return result
  }

  // ── Advanced Operations ─────────────────────────────────────────────────

  /** 5.1 Topological Sort — Kahn's algorithm, cached */
  topologicalSort(): string[] {
    if (this.topoCache) return this.topoCache

    const inDegree = new Map<string, number>()
    for (const id of this.nodes.keys()) inDegree.set(id, 0)
    for (const [, neighbours] of this.adj) {
      for (const to of neighbours) {
        inDegree.set(to, (inDegree.get(to) ?? 0) + 1)
      }
    }

    const queue: string[] = []
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id)
    }

    const sorted: string[] = []
    while (queue.length > 0) {
      const current = queue.shift()!
      sorted.push(current)
      for (const neighbour of this.adj.get(current) ?? []) {
        const newDeg = (inDegree.get(neighbour) ?? 1) - 1
        inDegree.set(neighbour, newDeg)
        if (newDeg === 0) queue.push(neighbour)
      }
    }

    if (sorted.length !== this.nodes.size) {
      throw new Error(`Cycle detected in project ${this.projectId}`)
    }

    this.topoCache = sorted
    return sorted
  }

  /** 5.2 Dependency depth — precomputed BFS from root nodes */
  getDepthMap(): Record<string, number> {
    return Object.fromEntries(this.depthMap)
  }

  /** 5.3 Tarjan's SCC algorithm */
  getSCCs(): SCCResult {
    const index: Map<string, number> = new Map()
    const lowlink: Map<string, number> = new Map()
    const onStack: Map<string, boolean> = new Map()
    const stack: string[] = []
    const components: string[][] = []
    let counter = 0

    const strongConnect = (v: string) => {
      index.set(v, counter)
      lowlink.set(v, counter)
      counter++
      stack.push(v)
      onStack.set(v, true)

      for (const w of this.adj.get(v) ?? []) {
        if (!index.has(w)) {
          strongConnect(w)
          lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!))
        } else if (onStack.get(w)) {
          lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!))
        }
      }

      if (lowlink.get(v) === index.get(v)) {
        const component: string[] = []
        let w: string
        do {
          w = stack.pop()!
          onStack.set(w, false)
          component.push(w)
        } while (w !== v)
        components.push(component)
      }
    }

    for (const id of this.nodes.keys()) {
      if (!index.has(id)) strongConnect(id)
    }

    const cyclicGroups = components.filter(c => c.length > 1)
    return { components, hasCycles: cyclicGroups.length > 0, cyclicGroups }
  }

  /** 5.4 Snapshot — serialise current graph state */
  snapshot(): SnapshotData {
    return {
      nodes: Object.fromEntries(this.nodes),
      edges: this.getAllEdges(),
      depthMap: this.getDepthMap(),
      generatedAt: new Date().toISOString(),
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  getAllEdges(): GraphEdge[] {
    const edges: GraphEdge[] = []
    for (const [from, neighbours] of this.adj) {
      for (const to of neighbours) {
        edges.push({ from, to, type: 'dependency' })
      }
    }
    return edges
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id)
  }

  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values())
  }

  nodeCount(): number { return this.nodes.size }
  edgeCount(): number {
    let count = 0
    for (const s of this.adj.values()) count += s.size
    return count
  }

  private recomputeDepths(): void {
    // BFS from root nodes (no incoming edges)
    this.depthMap.clear()
    const queue: [string, number][] = []

    for (const id of this.nodes.keys()) {
      if ((this.radj.get(id)?.size ?? 0) === 0) {
        this.depthMap.set(id, 0)
        queue.push([id, 0])
      }
    }

    while (queue.length > 0) {
      const [current, depth] = queue.shift()!
      for (const neighbour of this.adj.get(current) ?? []) {
        const existingDepth = this.depthMap.get(neighbour) ?? -1
        if (existingDepth < depth + 1) {
          this.depthMap.set(neighbour, depth + 1)
          queue.push([neighbour, depth + 1])
        }
      }
    }

    // Update node depth levels
    for (const [id, depth] of this.depthMap) {
      const node = this.nodes.get(id)
      if (node) node.depthLevel = depth
    }

    // Update affected counts
    for (const id of this.nodes.keys()) {
      const node = this.nodes.get(id)
      if (node) node.affectedCount = this.getAffectedBlocks(id).length
    }
  }

  private invalidateCaches(): void {
    this.topoCache = null
    this.subgraphCache.clear()
    this.lastEventAt = Date.now()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry — singleton per project
// ─────────────────────────────────────────────────────────────────────────────

class GraphRegistry {
  private engines: Map<string, GraphEngine> = new Map()
  private loadTimes: Map<string, number> = new Map()
  private readonly TTL_MS = 30 * 60 * 1000 // 30 min LRU

  async get(projectId: string): Promise<GraphEngine> {
    const now = Date.now()
    const existing = this.engines.get(projectId)

    if (existing) {
      this.loadTimes.set(projectId, now)
      return existing
    }

    const engine = new GraphEngine(projectId)
    await engine.loadFromDB()
    this.engines.set(projectId, engine)
    this.loadTimes.set(projectId, now)

    // LRU eviction
    for (const [pid, loadTime] of this.loadTimes) {
      if (now - loadTime > this.TTL_MS && pid !== projectId) {
        this.engines.delete(pid)
        this.loadTimes.delete(pid)
        console.log(`[graphify] Evicted project=${pid} from graph cache (TTL expired)`)
      }
    }

    return engine
  }

  /** Force reload from DB (after inconsistency detected) */
  async reload(projectId: string): Promise<GraphEngine> {
    this.engines.delete(projectId)
    return this.get(projectId)
  }

  invalidate(projectId: string): void {
    this.engines.delete(projectId)
    this.loadTimes.delete(projectId)
  }

  has(projectId: string): boolean {
    return this.engines.has(projectId)
  }
}

export const graphRegistry = new GraphRegistry()
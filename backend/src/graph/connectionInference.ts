/**
 * Connection Inference Engine — src/graph/connectionInference.ts
 *
 * Automatically infers and creates connections between blocks
 * based on block types, schema fields, and naming conventions.
 *
 * This is the production solution to the "edges=0" problem.
 * It runs:
 *   1. On project creation / first-load (seed pass)
 *   2. After every new block is created (auto-wire pass)
 *   3. On-demand via POST /api/graph/:projectId/infer
 *
 * INFERENCE RULES (priority order):
 *   Rule 1 — Type hierarchy:     database → backend → ui (canonical DAG)
 *                                 database → api → ui
 *                                 auth → backend | api
 *   Rule 2 — Name matching:      user-database ↔ user-backend (shared prefix)
 *   Rule 3 — Schema field refs:  blockJson.model === block id, etc.
 *   Rule 4 — Explicit declares:  blockJson.dependsOn[] array
 *   Rule 5 — Cross-cutting:      auth → all backend/api blocks
 *   Rule 6 — Title matching:     fuzzy match on blockJson.title words
 */

import prisma from '../lib/prisma'
import { graphRegistry } from './graphEngine'
import { emitConnectionCreated } from './graphEvents'
import { pathExists } from './cycleDetection'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface InferredConnection {
  fromBlockId: string
  toBlockId: string
  connectionType: 'dependency' | 'data_flow' | 'trigger'
  confidence: number   // 0.0 – 1.0
  rule: InferenceRule
  reason: string
}

export type InferenceRule =
  | 'type_hierarchy'
  | 'name_prefix_match'
  | 'schema_field_ref'
  | 'explicit_depends_on'
  | 'auth_cross_cutting'
  | 'title_keyword_match'
  | 'integration_wiring'

export interface InferenceResult {
  projectId: string
  inferred: InferredConnection[]
  created: number
  skipped: number
  cyclesPrevented: number
  durationMs: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Hierarchy — updated to match ACTUAL block types in DB
//
// Observed types:  auth | backend | database | ui | api | frontend
//
// Canonical flow:
//   database  → backend          (DB is consumed by backend)
//   database  → api              (DB is consumed by api layer too)
//   backend   → ui               (backend serves the frontend)
//   backend   → frontend         (backend serves the frontend app)
//   api       → ui               (api layer serves the frontend)
//   api       → backend          (api may sit in front of backend logic)
//   api       → frontend         (api layer serves the frontend app)
//   auth      → backend          (auth guards backend routes)
//   auth      → api              (auth guards api routes)
//   frontend  → (nothing)        (sink node, like ui)
//   ui        → (nothing)        (sink node)
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_HIERARCHY: Record<string, string[]> = {
  database: ['backend', 'api'],
  backend:  ['ui', 'frontend'],
  api:      ['ui', 'backend', 'frontend'],
  auth:     ['backend', 'api'],
  frontend: [],   // sink — nothing flows out of frontend
  ui:       [],   // sink — nothing flows out of ui
}

/**
 * Inverse of TYPE_HIERARCHY — "which types flow INTO this type?"
 * Used in auto-wire pass to find upstream blocks for a newly created block.
 */
const TYPE_DEPENDENTS: Record<string, string[]> = {}
for (const [from, tos] of Object.entries(TYPE_HIERARCHY)) {
  for (const to of tos) {
    if (!TYPE_DEPENDENTS[to]) TYPE_DEPENDENTS[to] = []
    TYPE_DEPENDENTS[to].push(from)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract a normalised prefix from a block's name or id.
 *  "user-model"  → "user"
 *  "order_api"   → "order"
 *  "UserUI"      → "user"
 *  "Main API"    → "main"   (title-style)
 */
function extractPrefix(name: string): string {
  // kebab-case
  const kebab = name.match(/^([a-z0-9]+)-/i)
  if (kebab) return kebab[1].toLowerCase()
  // snake_case
  const snake = name.match(/^([a-z0-9]+)_/i)
  if (snake) return snake[1].toLowerCase()
  // CamelCase
  const camel = name.match(/^([A-Z][a-z0-9]+)/)
  if (camel) return camel[1].toLowerCase()
  // Title-style "Main API" → "main"
  const titleWord = name.match(/^([A-Za-z0-9]+)\s/)
  if (titleWord) return titleWord[1].toLowerCase()
  return name.toLowerCase()
}

/**
 * Returns a display name for a block.
 * Priority: Block.name (top-level) > blockJson.title > blockJson.name > blockJson.label > id
 *
 * NOTE: By the time blocks reach inference rules, Block.name has already been
 * merged into blockJson.name (see main inferConnections() loader below).
 */
function blockName(blockJson: Record<string, unknown>, id: string): string {
  return (
    (blockJson?.name  as string) ||
    (blockJson?.title as string) ||
    (blockJson?.label as string) ||
    id
  )
}

/**
 * Extract meaningful keywords from a block title for fuzzy matching.
 * "PostgreSQL DB" → ["postgresql", "db"]
 * "Task List UI"  → ["task", "list", "ui"]
 *
 * Filters out common generic words that appear in every block.
 */
const STOP_WORDS = new Set([
  'api', 'ui', 'db', 'database', 'backend', 'auth', 'service', 'main',
  'default', 'stack', 'layer', 'server', 'client', 'app', 'the', 'and',
  'frontend',
])

function extractTitleKeywords(blockJson: Record<string, unknown>): string[] {
  const title = (blockJson?.title as string) || (blockJson?.name as string) || ''
  return title
    .toLowerCase()
    .split(/[\s_\-]+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

// ─────────────────────────────────────────────────────────────────────────────
// Block type
// ─────────────────────────────────────────────────────────────────────────────

interface Block {
  id: string
  blockType: string
  blockJson: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Inference Rules
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rule 1 — Type Hierarchy
 *
 * For blocks that share a name/title prefix AND have a type relationship
 * defined in TYPE_HIERARCHY, infer a dependency edge.
 *
 * When all blocks have generic titles (e.g. "Main API", "PostgreSQL DB") with
 * no shared prefix, we fall back to wiring ALL pairs that satisfy the type
 * relationship — because in a small project every database feeds every backend.
 *
 * Confidence: 0.85 for prefix-matched pairs, 0.75 for type-only pairs.
 */
function ruleTypeHierarchy(blocks: Block[]): InferredConnection[] {
  const results: InferredConnection[] = []

  for (const from of blocks) {
    const allowedTargetTypes = TYPE_HIERARCHY[from.blockType] ?? []
    if (allowedTargetTypes.length === 0) continue

    const fromPrefix = extractPrefix(blockName(from.blockJson, from.id))

    for (const to of blocks) {
      if (from.id === to.id) continue
      if (!allowedTargetTypes.includes(to.blockType)) continue

      const toPrefix = extractPrefix(blockName(to.blockJson, to.id))

      if (fromPrefix === toPrefix) {
        // Strong match — same feature prefix
        results.push({
          fromBlockId: from.id,
          toBlockId: to.id,
          connectionType: 'dependency',
          confidence: 0.85,
          rule: 'type_hierarchy',
          reason: `${from.blockType}(${fromPrefix}) → ${to.blockType}(${toPrefix}) via type hierarchy + shared prefix`,
        })
      } else {
        // Fallback — type relationship holds even without prefix match.
        // Handles the common "one of each type" project layout where
        // all blocks have generic names like "Main API" / "PostgreSQL DB".
        results.push({
          fromBlockId: from.id,
          toBlockId: to.id,
          connectionType: 'dependency',
          confidence: 0.75,
          rule: 'type_hierarchy',
          reason: `${from.blockType} → ${to.blockType} via type hierarchy (no prefix match)`,
        })
      }
    }
  }

  return results
}

/**
 * Rule 2 — Name Prefix Match
 *
 * Connects blocks sharing a name prefix that aren't already covered by
 * Rule 1's strong (prefix + type) path. Lower confidence (0.65).
 *
 * Guards:
 *  - Skips same-type pairs (ui→ui, backend→backend add no architectural value)
 *  - Skips pairs already covered by Rule 1's type hierarchy
 */
function ruleNamePrefixMatch(blocks: Block[]): InferredConnection[] {
  const results: InferredConnection[] = []

  // Group blocks by extracted prefix
  const byPrefix: Record<string, Block[]> = {}
  for (const b of blocks) {
    const prefix = extractPrefix(blockName(b.blockJson, b.id))
    if (!byPrefix[prefix]) byPrefix[prefix] = []
    byPrefix[prefix].push(b)
  }

  // Canonical type order (lower index = more "upstream")
  const typeOrder = ['database', 'auth', 'api', 'backend', 'frontend', 'ui']

  for (const [prefix, group] of Object.entries(byPrefix)) {
    if (group.length < 2) continue

    const sorted = [...group].sort(
      (a, b) => typeOrder.indexOf(a.blockType) - typeOrder.indexOf(b.blockType)
    )

    for (let i = 0; i < sorted.length - 1; i++) {
      const from = sorted[i]
      const to   = sorted[i + 1]

      // Skip same-type connections — ui→ui, backend→backend etc. are not meaningful
      if (from.blockType === to.blockType) continue

      // Skip pairs already emitted by Rule 1 (type hierarchy covers them)
      const typeCovers = (TYPE_HIERARCHY[from.blockType] ?? []).includes(to.blockType)
      if (typeCovers) continue

      results.push({
        fromBlockId: from.id,
        toBlockId: to.id,
        connectionType: 'dependency',
        confidence: 0.65,
        rule: 'name_prefix_match',
        reason: `Shared prefix "${prefix}": ${from.blockType} → ${to.blockType}`,
      })
    }
  }

  return results
}

/**
 * Rule 3 — Schema Field References
 *
 * A block's blockJson may contain explicit foreign-key style references:
 *   { "model": "<blockId>" }
 *   { "apiId": "<blockId>" }
 *   { "dataSource": "<blockId>" }
 *   { "backendId": "<blockId>" }
 *   { "databaseId": "<blockId>" }
 *
 * High confidence (0.95) because these are developer-supplied explicit refs.
 */
const SCHEMA_REF_FIELDS = [
  'model', 'apiId', 'api', 'dataSource', 'source',
  'serviceId', 'authId', 'integrationId',
  'backendId', 'databaseId', 'dbId',
]

function ruleSchemaFieldRefs(blocks: Block[]): InferredConnection[] {
  const results: InferredConnection[] = []
  const blockIds = new Set(blocks.map(b => b.id))

  for (const from of blocks) {
    for (const field of SCHEMA_REF_FIELDS) {
      const ref = from.blockJson?.[field] as string | undefined
      if (!ref || !blockIds.has(ref) || ref === from.id) continue

      results.push({
        fromBlockId: ref,    // referenced block is the upstream dependency
        toBlockId: from.id,  // current block depends on the reference
        connectionType: 'data_flow',
        confidence: 0.95,
        rule: 'schema_field_ref',
        reason: `blockJson.${field} = "${ref}" (explicit schema reference)`,
      })
    }
  }

  return results
}

/**
 * Rule 4 — Explicit dependsOn Array
 *
 *   { "dependsOn": ["<blockId>", "<blockId>"] }
 *
 * Maximum confidence (1.0) — developer declared this explicitly.
 */
function ruleExplicitDependsOn(blocks: Block[]): InferredConnection[] {
  const results: InferredConnection[] = []
  const blockIds = new Set(blocks.map(b => b.id))

  for (const block of blocks) {
    const deps = block.blockJson?.dependsOn as string[] | undefined
    if (!Array.isArray(deps)) continue

    for (const depId of deps) {
      if (!blockIds.has(depId) || depId === block.id) continue

      results.push({
        fromBlockId: depId,
        toBlockId: block.id,
        connectionType: 'dependency',
        confidence: 1.0,
        rule: 'explicit_depends_on',
        reason: `Explicit blockJson.dependsOn declaration`,
      })
    }
  }

  return results
}

/**
 * Rule 5 — Auth Cross-Cutting
 *
 * Auth blocks protect ALL backend and api blocks in the project.
 * Only fires for blocks that don't share a prefix (those are handled by Rule 1).
 * Confidence 0.70 — lower because it may over-connect in large projects.
 */
function ruleAuthCrossCutting(blocks: Block[]): InferredConnection[] {
  const results: InferredConnection[] = []

  const authBlocks   = blocks.filter(b => b.blockType === 'auth')
  const targetBlocks = blocks.filter(b => b.blockType === 'backend' || b.blockType === 'api')

  for (const auth of authBlocks) {
    const authPrefix = extractPrefix(blockName(auth.blockJson, auth.id))

    for (const target of targetBlocks) {
      const targetPrefix = extractPrefix(blockName(target.blockJson, target.id))

      // Same prefix already wired by Rule 1
      if (authPrefix === targetPrefix) continue

      results.push({
        fromBlockId: auth.id,
        toBlockId: target.id,
        connectionType: 'dependency',
        confidence: 0.70,
        rule: 'auth_cross_cutting',
        reason: `Auth is a cross-cutting concern for ${target.blockType} "${blockName(target.blockJson, target.id)}"`,
      })
    }
  }

  return results
}

/**
 * Rule 6 — Title Keyword Match
 *
 * When two blocks from different layers share a meaningful keyword in their
 * title (e.g. "Task List UI" and "Task Service"), they are likely related.
 *
 * Only fires between blocks where a TYPE_HIERARCHY relationship exists.
 * Confidence 0.72.
 */
function ruleTitleKeywordMatch(blocks: Block[]): InferredConnection[] {
  const results: InferredConnection[] = []

  for (const from of blocks) {
    const allowedTargetTypes = TYPE_HIERARCHY[from.blockType] ?? []
    if (allowedTargetTypes.length === 0) continue

    const fromKeywords = new Set(extractTitleKeywords(from.blockJson))
    if (fromKeywords.size === 0) continue

    for (const to of blocks) {
      if (from.id === to.id) continue
      if (!allowedTargetTypes.includes(to.blockType)) continue

      const toKeywords = extractTitleKeywords(to.blockJson)
      const shared = toKeywords.filter(k => fromKeywords.has(k))
      if (shared.length === 0) continue

      results.push({
        fromBlockId: from.id,
        toBlockId: to.id,
        connectionType: 'data_flow',
        confidence: 0.72,
        rule: 'title_keyword_match',
        reason: `Shared title keywords [${shared.join(', ')}]: ${from.blockType} → ${to.blockType}`,
      })
    }
  }

  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// Deduplication + Confidence Filter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merge all inferred connections, deduplicate (highest confidence wins),
 * and filter below the confidence threshold.
 */
function deduplicateAndRank(
  inferred: InferredConnection[],
  confidenceThreshold = 0.60,
): InferredConnection[] {
  const seen = new Set<string>()
  const unique: InferredConnection[] = []

  // Sort highest confidence first so that the first occurrence wins dedup
  const sorted = [...inferred].sort((a, b) => b.confidence - a.confidence)

  for (const conn of sorted) {
    const key = `${conn.fromBlockId}→${conn.toBlockId}`
    if (seen.has(key)) continue
    if (conn.confidence < confidenceThreshold) continue
    seen.add(key)
    unique.push(conn)
  }

  return unique
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Inference Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run all inference rules for a project and persist the results.
 *
 * @param projectId           - Project to infer connections for
 * @param triggeredBy         - Clerk user ID (for event logging)
 * @param confidenceThreshold - Min confidence to persist (default 0.60)
 * @param dryRun              - If true, returns what WOULD be created without writing to DB
 */
export async function inferConnections(
  projectId: string,
  triggeredBy?: string,
  confidenceThreshold = 0.60,
  dryRun = false,
): Promise<InferenceResult> {
  const startTime = Date.now()

  // 1. Load all live blocks for this project
  const rawBlocks = await prisma.block.findMany({
    where: { projectId, deletedAt: null },
    select: { id: true, blockType: true, blockJson: true, name: true },
  })

  const blocks: Block[] = rawBlocks.map(b => ({
    id: b.id,
    blockType: b.blockType,
    blockJson: {
      ...(b.blockJson as Record<string, unknown> ?? {}),
      // Top-level Block.name always wins over blockJson.name
      ...(b.name ? { name: b.name } : {}),
    },
  }))

  if (blocks.length < 2) {
    return {
      projectId, inferred: [], created: 0, skipped: 0,
      cyclesPrevented: 0, durationMs: Date.now() - startTime,
    }
  }

  // 2. Log which block types are present (helps diagnose future mismatches)
  const typesSeen = [...new Set(blocks.map(b => b.blockType))].sort()
  console.log(`[inference] project=${projectId} blockTypes=[${typesSeen.join(', ')}] count=${blocks.length}`)

  // 3. Load existing connections so we don't re-create them
  const existingConns = await prisma.connection.findMany({
    where: { projectId, deletedAt: null },
    select: { fromBlockId: true, toBlockId: true },
  })
  const existingSet = new Set(existingConns.map(c => `${c.fromBlockId}→${c.toBlockId}`))

  // 4. Run all rules (highest-confidence first)
  const allInferred: InferredConnection[] = [
    ...ruleExplicitDependsOn(blocks),   // 1.00 — developer declared
    ...ruleSchemaFieldRefs(blocks),     // 0.95 — explicit JSON refs
    ...ruleTypeHierarchy(blocks),       // 0.85 / 0.75 — structural
    ...ruleTitleKeywordMatch(blocks),   // 0.72 — heuristic
    ...ruleAuthCrossCutting(blocks),    // 0.70 — cross-cutting
    ...ruleNamePrefixMatch(blocks),     // 0.65 — heuristic
  ]

  // 5. Deduplicate and apply confidence threshold
  const candidates = deduplicateAndRank(allInferred, confidenceThreshold)

  // 6. Remove already-existing connections
  const newConnections = candidates.filter(
    c => !existingSet.has(`${c.fromBlockId}→${c.toBlockId}`)
  )

  if (dryRun) {
    return {
      projectId,
      inferred: newConnections,
      created: 0,
      skipped: newConnections.length,
      cyclesPrevented: 0,
      durationMs: Date.now() - startTime,
    }
  }

  // 7. Get the live in-memory graph engine for cycle detection
  const engine = await graphRegistry.get(projectId)

  let created = 0
  let skipped = 0
  let cyclesPrevented = 0

  for (const conn of newConnections) {
    // Layer 1 — DB-backed path check (same semantics as connections.ts)
    const wouldCycle = await pathExists(projectId, conn.toBlockId, conn.fromBlockId)
    if (wouldCycle) {
      cyclesPrevented++
      console.warn(
        `[inference] Cycle prevented (pathExists): ${conn.fromBlockId} → ${conn.toBlockId} ` +
        `(rule: ${conn.rule})`
      )
      continue
    }

    // Layer 2 — In-memory engine (catches cycles built up mid-loop)
    engine.addEdge(conn.fromBlockId, conn.toBlockId)
    if (engine.detectCycles()) {
      engine.removeEdge(conn.fromBlockId, conn.toBlockId)
      cyclesPrevented++
      console.warn(
        `[inference] Cycle prevented (in-memory): ${conn.fromBlockId} → ${conn.toBlockId} ` +
        `(rule: ${conn.rule})`
      )
      continue
    }

    // Persist
    try {
      await prisma.connection.create({
        data: {
          projectId,
          fromBlockId: conn.fromBlockId,
          toBlockId:   conn.toBlockId,
          connectionType: conn.connectionType,
        },
      })

      await emitConnectionCreated(projectId, conn.fromBlockId, conn.toBlockId, triggeredBy)
      created++

      console.log(
        `[inference] Created: ${conn.fromBlockId} → ${conn.toBlockId} ` +
        `(rule=${conn.rule}, confidence=${conn.confidence.toFixed(2)}, type=${conn.connectionType})`
      )
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'P2002') {
        // Race condition — connection already exists, harmless
        skipped++
      } else {
        engine.removeEdge(conn.fromBlockId, conn.toBlockId)
        console.error(`[inference] Failed to persist connection:`, err)
        skipped++
      }
    }
  }

  const durationMs = Date.now() - startTime
  console.log(
    `[inference] Done project=${projectId} ` +
    `created=${created} skipped=${skipped} cyclesPrevented=${cyclesPrevented} ` +
    `durationMs=${durationMs}`
  )

  return { projectId, inferred: newConnections, created, skipped, cyclesPrevented, durationMs }
}

/**
 * Auto-wire a newly created block into the existing graph.
 * Called from the blocks route after BLOCK_CREATED event.
 * Uses a higher confidence threshold (0.75) to avoid noisy connections.
 */
export async function autoWireNewBlock(
  projectId: string,
  newBlockId: string,
  triggeredBy?: string,
): Promise<{ created: number }> {
  try {
    const result = await inferConnections(projectId, triggeredBy, 0.75, false)
    const relevant = result.inferred.filter(
      c => c.fromBlockId === newBlockId || c.toBlockId === newBlockId
    )
    console.log(`[inference] Auto-wired block=${newBlockId} relevant=${relevant.length} total_created=${result.created}`)
    return { created: result.created }
  } catch (err) {
    console.error(`[inference] autoWireNewBlock failed for block=${newBlockId}:`, err)
    return { created: 0 }
  }
}
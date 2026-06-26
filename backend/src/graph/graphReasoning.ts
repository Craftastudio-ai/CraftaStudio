/**
 * Graph Reasoning AI — src/graph/graphReasoning.ts
 *
 * Transforms raw structural graph data into decisions, predictions, and explanations.
 * Never works on raw text alone — always starts with structured graph data + memory context.
 *
 * Five reasoning modes:
 *   1. impact_analysis      — what is at risk after a block change
 *   2. root_cause_analysis  — why is something failing
 *   3. optimization         — architecture improvement suggestions
 *   4. simulation           — what-if structural changes
 *   5. conflict_resolution  — how to resolve detected conflicts
 */

import crypto from 'crypto'
import prisma from '../lib/prisma'
import { graphRegistry, type SubgraphResult } from './graphEngine'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ReasoningMode =
  | 'impact_analysis'
  | 'root_cause_analysis'
  | 'optimization'
  | 'simulation'
  | 'conflict_resolution'

export interface ReasoningInput {
  projectId: string
  mode: ReasoningMode
  blockId?: string           // anchor block for impact/root cause/conflict
  userContext?: string       // natural language from user
  simulationChange?: {       // for simulation mode
    action: 'add_block' | 'remove_block' | 'add_connection' | 'remove_connection'
    from?: string
    to?: string
    blockType?: string
  }
  conflictId?: string        // for conflict_resolution mode
}

export interface ReasoningDecision {
  mode: ReasoningMode
  summary: string
  riskScore?: number         // 0–10
  affectedBlocks?: string[]
  recommendations: string[]
  regenerationOrder?: string[]
  confidence: number
  tokensUsed: number
  model: string
  cachedAt?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Token budgets per mode (from doc §15.1)
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_BUDGET: Record<ReasoningMode, number> = {
  impact_analysis:     1000,
  root_cause_analysis: 1500,
  optimization:        2000,
  simulation:          2500,
  conflict_resolution: 2000,
}

const MODEL_BY_MODE: Record<ReasoningMode, string> = {
  impact_analysis:     'claude-3-5-haiku-20241022',
  root_cause_analysis: 'claude-3-5-haiku-20241022',
  optimization:        'claude-3-5-haiku-20241022',
  simulation:          'claude-3-5-haiku-20241022',
  conflict_resolution: 'claude-3-5-haiku-20241022',
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode Classifier — Step 11.1 (no Claude call needed)
// ─────────────────────────────────────────────────────────────────────────────

export function classifyMode(input: Partial<ReasoningInput> & { userContext?: string }): ReasoningMode {
  if (input.mode) return input.mode

  const text = (input.userContext ?? '').toLowerCase()

  if (text.includes('what if') || text.includes('simulate') || text.includes('hypothetical')) {
    return 'simulation'
  }
  if (text.includes('why') || text.includes('error') || text.includes('failure') || text.includes('broken')) {
    return 'root_cause_analysis'
  }
  if (text.includes('conflict') || text.includes('resolve') || text.includes('incompatible')) {
    return 'conflict_resolution'
  }
  if (text.includes('improve') || text.includes('optimise') || text.includes('optimize') || text.includes('better')) {
    return 'optimization'
  }
  return 'impact_analysis' // default
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Builder — Step 11.2 (the most important component)
// ─────────────────────────────────────────────────────────────────────────────

async function buildContext(input: ReasoningInput): Promise<{
  subgraph: SubgraphResult
  memoryContext: Record<string, unknown>
  affectedBlocks: string[]
  upstreamBlocks: string[]
  depthMap: Record<string, number>
  nodeCount: number
}> {
  const engine = await graphRegistry.get(input.projectId)

  // Get relevant structural data
  let affectedBlocks: string[] = []
  let upstreamBlocks: string[] = []
  let subgraphBlockIds: string[] = []

  if (input.blockId) {
    affectedBlocks = engine.getAffectedBlocks(input.blockId)
    upstreamBlocks = engine.getUpstream(input.blockId)
    // For subgraph: include the block + its immediate neighbourhood (not full graph)
    subgraphBlockIds = [
      input.blockId,
      ...engine.getDownstream(input.blockId),
      ...Array.from(new Set(upstreamBlocks)).slice(0, 5), // limit upstream to 5 to control tokens
    ]
  } else {
    // No anchor block — use all blocks but limit to top 20 by depth
    const allNodes = engine.getAllNodes()
      .sort((a, b) => b.affectedCount - a.affectedCount)
      .slice(0, 20)
    subgraphBlockIds = allNodes.map(n => n.id)
  }

  const subgraph = engine.getSubgraph(subgraphBlockIds)
  const depthMap = engine.getDepthMap()

  // Fetch memory context (top 10 high-confidence memories)
  const memories = await prisma.memory.findMany({
    where: {
      projectId: input.projectId,
      confidence: { gte: 0.5 },
    },
    orderBy: [{ priority: 'asc' }, { confidence: 'desc' }],
    take: 10,
    select: { key: true, value: true, type: true, confidence: true },
  })

  const memoryContext: Record<string, unknown> = {}
  for (const mem of memories) {
    memoryContext[mem.key] = (mem.value as Record<string, unknown>)?.raw ?? mem.value
  }

  return {
    subgraph,
    memoryContext,
    affectedBlocks,
    upstreamBlocks,
    depthMap,
    nodeCount: engine.nodeCount(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Templates — §13.1
// ─────────────────────────────────────────────────────────────────────────────

function buildPrompt(mode: ReasoningMode, context: Awaited<ReturnType<typeof buildContext>>, input: ReasoningInput): string {
  const graphSummary = `
GRAPH STRUCTURE:
- Total nodes: ${context.nodeCount}
- Subgraph nodes: ${JSON.stringify(context.subgraph.nodes.map(n => ({ id: n.id, type: n.blockType, depth: n.depthLevel, affects: n.affectedCount })))}
- Edges in scope: ${JSON.stringify(context.subgraph.edges)}
- Affected blocks (downstream): ${JSON.stringify(context.affectedBlocks)}
- Upstream dependencies: ${JSON.stringify(context.upstreamBlocks)}

MEMORY CONTEXT (architectural decisions):
${JSON.stringify(context.memoryContext, null, 2)}

USER CONTEXT: ${input.userContext ?? 'No additional context provided.'}
`.trim()

  const outputSchema = `
Respond ONLY with a valid JSON object with this exact structure:
{
  "summary": "one clear sentence describing the situation",
  "riskScore": <number 0-10>,
  "affectedBlocks": ["blockId1", "blockId2"],
  "recommendations": ["action 1", "action 2", "action 3"],
  "regenerationOrder": ["blockId in generation order"],
  "confidence": <number 0.0-1.0>,
  "reasoning": "internal chain-of-thought (not shown to user)"
}
`.trim()

  const modeInstructions: Record<ReasoningMode, string> = {
    impact_analysis: `You are a software architecture impact analyser. Given the block graph below, determine what is at risk after changes to block ${input.blockId ?? 'the system'}. Focus on: which downstream blocks must be regenerated, what the risk level is, and in what order regeneration should happen.`,

    root_cause_analysis: `You are a root cause analyser for software systems. Given the block graph and the failing block ${input.blockId ?? 'unknown'}, trace upstream dependencies to find the most likely origin of the failure. Explain the failure chain clearly.`,

    optimization: `You are a software architecture optimiser. Analyse this block graph for anti-patterns: tight coupling, missing abstractions, unnecessary dependencies, or scalability bottlenecks. Provide concrete, actionable recommendations to improve the architecture.`,

    simulation: `You are simulating a structural change to this software architecture. The proposed change is: ${JSON.stringify(input.simulationChange ?? {})}. Reason over the result as if the change was already made. What breaks? What improves? What must be regenerated?`,

    conflict_resolution: `You are a conflict resolution system for software architecture. A hard conflict (risk score 7+) has been detected${input.conflictId ? ` (conflict ID: ${input.conflictId})` : ''}. Analyse the full graph context and recommend the best resolution strategy: accept_ai, accept_human, merge, escalate, or defer. Explain why.`,
  }

  return `${modeInstructions[mode]}

${graphSummary}

${outputSchema}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache — §15.2
// ─────────────────────────────────────────────────────────────────────────────

function buildInputHash(input: ReasoningInput): string {
  const key = JSON.stringify({
    mode: input.mode,
    blockId: input.blockId,
    userContext: input.userContext,
    simulationChange: input.simulationChange,
  })
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32)
}

async function getCachedResult(
  projectId: string,
  mode: ReasoningMode,
  inputHash: string,
): Promise<ReasoningDecision | null> {
  try {
    const cached = await prisma.reasoningResult.findUnique({
      where: { projectId_mode_inputHash: { projectId, mode: mode as import("@prisma/client").ReasoningMode, inputHash } },
    })

    if (!cached) return null
    if (cached.expiresAt < new Date()) return null // expired

    return {
      ...(cached.result as unknown as ReasoningDecision),
      cachedAt: cached.createdAt.toISOString(),
    }
  } catch {
    return null
  }
}

async function cacheResult(
  projectId: string,
  blockId: string | undefined,
  mode: ReasoningMode,
  inputHash: string,
  result: ReasoningDecision,
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 min TTL
    await prisma.reasoningResult.upsert({
      where: { projectId_mode_inputHash: { projectId, mode: mode as import("@prisma/client").ReasoningMode, inputHash } },
      create: {
        projectId,
        blockId,
        mode: mode as import("@prisma/client").ReasoningMode,
        inputHash,
        result: result as unknown as import('@prisma/client').Prisma.JsonObject,
        confidence: result.confidence,
        tokensUsed: result.tokensUsed,
        model: result.model,
        expiresAt,
      },
      update: {
        result: result as unknown as import('@prisma/client').Prisma.JsonObject,
        confidence: result.confidence,
        tokensUsed: result.tokensUsed,
        expiresAt,
      },
    })
  } catch (err) {
    console.error('[reasoning] Failed to cache result:', err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Reasoning Pipeline — §11
// ─────────────────────────────────────────────────────────────────────────────

export async function runReasoning(input: ReasoningInput): Promise<ReasoningDecision> {
  const mode = classifyMode(input)
  const inputHash = buildInputHash({ ...input, mode })

  // Step 1: Check cache
  const cached = await getCachedResult(input.projectId, mode, inputHash)
  if (cached) {
    console.log(`[reasoning] Cache hit — project=${input.projectId} mode=${mode}`)
    return cached
  }

  // Step 2: Build context (structural + memory)
  const context = await buildContext({ ...input, mode })

  // Step 3: Build prompt
  const prompt = buildPrompt(mode, context, { ...input, mode })
  const model = MODEL_BY_MODE[mode]
  const maxTokens = TOKEN_BUDGET[mode]

  console.log(`[reasoning] Running ${mode} — project=${input.projectId} model=${model}`)

  // Step 4: Call Anthropic API
  let decision: ReasoningDecision

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Anthropic API error ${response.status}: ${String(err)}`)
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>
      usage: { input_tokens: number; output_tokens: number }
    }

    const rawText = data.content.find(c => c.type === 'text')?.text ?? '{}'
    const tokensUsed = (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0)

    // Parse JSON response
    let parsed: Record<string, unknown>
    try {
      const clean = rawText.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      parsed = { summary: rawText, recommendations: [], confidence: 0.5 }
    }

    decision = {
      mode,
      summary: parsed.summary as string ?? 'Analysis complete.',
      riskScore: parsed.riskScore as number,
      affectedBlocks: (parsed.affectedBlocks as string[]) ?? context.affectedBlocks,
      recommendations: (parsed.recommendations as string[]) ?? [],
      regenerationOrder: parsed.regenerationOrder as string[],
      confidence: (parsed.confidence as number) ?? 0.7,
      tokensUsed,
      model,
    }

  } catch (err: unknown) {
    console.error(`[reasoning] API call failed:`, err instanceof Error ? err.message : String(err))
    // Graceful fallback — return structural data without AI
    decision = {
      mode,
      summary: `Structural analysis: ${context.affectedBlocks.length} blocks affected downstream.`,
      riskScore: Math.min(10, context.affectedBlocks.length * 2),
      affectedBlocks: context.affectedBlocks,
      recommendations: [
        'Review downstream blocks for compatibility.',
        'Consider regenerating affected blocks in topological order.',
      ],
      confidence: 0.4,
      tokensUsed: 0,
      model: 'fallback',
    }
  }

  // Step 5: Cache result
  await cacheResult(input.projectId, input.blockId, mode, inputHash, decision)

  return decision
}
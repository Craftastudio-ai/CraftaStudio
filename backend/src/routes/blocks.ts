/**
 * Blocks Routes — src/routes/blocks.ts
 *
 * CHANGED: POST / now calls autoWireNewBlock after block creation.
 * This auto-connects the new block into the existing graph via inference
 * at high confidence (>= 0.75) immediately after creation.
 *
 * CHANGED: Block chat now triggers cascade regeneration of downstream blocks
 * when action === 'regenerate_block'. Downstream blocks are re-queued via
 * BullMQ in topological order, tagged pending_regen, and broadcast via WS.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../lib/prisma'
import type { InputJsonValue } from '@prisma/client/runtime/library'
import { verifyClerk } from '../middleware/clerkAuth'
import { getOrCreateUser } from '../lib/getOrCreateUser'
import { emitBlockCreated, emitBlockDeleted } from '../graph/graphEvents'
import { autoWireNewBlock } from '../graph/connectionInference'
import { findDownstreamCascade } from '../graph/cascadeRegen'
import { blockGenerationQueue } from '../queue/blockQueue'
import { broadcastToProject } from '../ws/wsManager'
import { askLLM } from '../lib/llm'

// ─────────────────────────────────────────────────────────────────────────────

export const BLOCK_TYPES = ['database', 'backend', 'api', 'ui', 'auth', 'frontend', 'service', 'job', 'worker', 'integration'] as const
export type BlockType = typeof BLOCK_TYPES[number]

const CreateBlockSchema = z.object({
  projectId: z.string().uuid(),
  blockType:  z.enum(BLOCK_TYPES),
  blockJson:  z.record(z.unknown()),
})

// ─────────────────────────────────────────────────────────────────────────────

export async function blocksRoutes(app: FastifyInstance) {

  /** GET /api/blocks/health — no auth, returns AI + infra status */
  app.get('/health', async (_req, reply) => {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY ?? ''
    const model = process.env.CLAUDE_PLAN_MODEL ?? 'claude-haiku-4-5-20251001'
    return reply.send({
      status: 'ok',
      anthropic: apiKey ? 'configured' : 'missing',
      model,
      groq: process.env.GROQ_API_KEY ? 'configured' : 'missing',
      timestamp: new Date().toISOString(),
    })
  })

  /** GET /api/blocks/debug-llm — no auth, returns details of configured keys and tests connectivity if test=true */
  app.get('/debug-llm', async (req, reply) => {
    const { test } = req.query as { test?: string }
    const status = {
      anthropic: (process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY ?? '').trim() ? 'configured' : 'missing',
      openrouter: (process.env.OPENROUTER_API_KEY ?? '').trim() ? 'configured' : 'missing',
      env: {
        CLAUDE_PLAN_MODEL: process.env.CLAUDE_PLAN_MODEL ?? 'claude-haiku-4-5-20251001',
      },
      results: {} as any
    }

    if (test === 'true') {
      // 1. Test Anthropic Direct
      try {
        const key = (process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY ?? '').trim()
        if (key) {
          const model = process.env.CLAUDE_PLAN_MODEL ?? 'claude-haiku-4-5-20251001'
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': key,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model,
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Say OK' }],
            }),
            signal: AbortSignal.timeout(10000)
          })
          const text = await res.text()
          status.results.anthropic = { status: res.status, body: text }
        } else {
          status.results.anthropic = 'skipped: key missing'
        }
      } catch (err: any) {
        status.results.anthropic = { error: err.message }
      }

      // 2. Test OpenRouter (using Claude model)
      try {
        const key = (process.env.OPENROUTER_API_KEY ?? '').trim()
        if (key) {
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({
              model: 'anthropic/claude-3-5-haiku',
              messages: [{ role: 'user', content: 'Say OK' }],
              max_tokens: 10,
            }),
            signal: AbortSignal.timeout(10000)
          })
          const text = await res.text()
          status.results.openrouter = { status: res.status, body: text }
        } else {
          status.results.openrouter = 'skipped: key missing'
        }
      } catch (err: any) {
        status.results.openrouter = { error: err.message }
      }
    }

    return reply.send(status)
  })

  /** GET all blocks */
  app.get('/', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { projectId } = req.query as { projectId?: string }
    if (!projectId) return reply.code(400).send({ error: 'projectId is required' })

    const blocks = await prisma.block.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send(blocks)
  })

  /** GET block by id */
  app.get('/:id', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { id } = req.params as { id: string }

    const block = await prisma.block.findUnique({ where: { id } })
    if (!block) return reply.code(404).send({ error: 'Block not found' })
    return reply.send(block)
  })

  /** CREATE block + auto-wire into graph */
  app.post('/', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    const clerkId = req.user.sub
    await getOrCreateUser(clerkId)

    const parsed = CreateBlockSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(422).send({ error: parsed.error.flatten() })

    const block = await prisma.block.create({
      data: {
        projectId: parsed.data.projectId,
        blockType:  parsed.data.blockType,
        blockJson:  parsed.data.blockJson as InputJsonValue,
      },
    })

    // Fire graph event + auto-wire (both non-blocking)
    emitBlockCreated(parsed.data.projectId, block.id, block.blockType, clerkId).catch(
      err => console.error('[blocks] emitBlockCreated failed:', err)
    )

    // Auto-wire: connect the new block into the existing graph at high confidence
    autoWireNewBlock(parsed.data.projectId, block.id, clerkId).catch(
      err => console.error('[blocks] autoWireNewBlock failed:', err)
    )

    return reply.code(201).send(block)
  })

  /** UPDATE block */
  app.patch('/:id', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { id } = req.params as { id: string }

    const parsed = z.object({ blockJson: z.record(z.unknown()) }).safeParse(req.body)
    if (!parsed.success) return reply.code(422).send({ error: parsed.error.flatten() })

    const block = await prisma.block.update({
      where: { id },
      data:  { blockJson: parsed.data.blockJson as InputJsonValue },
    })
    return reply.send(block)
  })

  /** GET latest generated output — prefers 'done' status */
  app.get('/:id/output', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { id: blockId } = req.params as { id: string }
    const { runId }        = req.query  as { runId?: string }

    // If a specific runId is requested, use it directly
    if (runId) {
      const output = await prisma.blockOutput.findFirst({ where: { blockId, runId }, orderBy: { createdAt: 'desc' } })
      if (!output) return reply.code(404).send({ error: 'No output found for this block' })
      return reply.send(output)
    }

    // Otherwise: prefer the latest DONE output (has actual code), fall back to any latest
    const doneOutput = await prisma.blockOutput.findFirst({
      where: { blockId, status: 'done' },
      orderBy: { createdAt: 'desc' },
    })
    if (doneOutput) return reply.send(doneOutput)

    const anyOutput = await prisma.blockOutput.findFirst({ where: { blockId }, orderBy: { createdAt: 'desc' } })
    if (!anyOutput) return reply.code(404).send({ error: 'No output found for this block' })
    return reply.send(anyOutput)
  })

  /** GET output history */
  app.get('/:id/outputs', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { id: blockId } = req.params as { id: string }

    const outputs = await prisma.blockOutput.findMany({
      where:   { blockId },
      orderBy: { createdAt: 'desc' },
      take:    10,
    })
    return reply.send(outputs)
  })

  /** GET /api/blocks/:id/chat — load persisted chat history for a block */
  app.get('/:id/chat', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { id: blockId } = req.params as { id: string }
    const messages = await prisma.blockChat.findMany({
      where: { blockId },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send(messages)
  })

  /** POST /api/blocks/:id/chat — send a message, get AI response, persist both */
  app.post('/:id/chat', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    await getOrCreateUser(req.user.sub)
    const { id: blockId } = req.params as { id: string }

    const { message, chatHistory = [], blockContext = {}, projectId } = req.body as {
      message: string
      chatHistory: { role: string; content: string }[]
      blockContext: Record<string, unknown>
      projectId?: string
    }

    if (!message?.trim()) return reply.code(400).send({ error: 'message is required' })

    // Load block from DB for full metadata
    const block = await prisma.block.findUnique({ where: { id: blockId } })
    if (!block) return reply.code(404).send({ error: 'Block not found' })

    // Load project planDoc for full context
    let planDoc = ''
    if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { planDoc: true } })
      planDoc = project?.planDoc ?? ''
    }

    const blockJson = block.blockJson as Record<string, any>
    const blockTitle = blockJson?.title ?? block.blockType

    const systemPrompt = `You are an expert software architect assistant inside CraftaStudio.
The user is reviewing a specific architecture block: "${blockTitle}".

Block details:
${JSON.stringify(blockJson, null, 2)}

Full project plan:
${planDoc ? planDoc.slice(0, 4000) : 'Not available'}

The user may ask you to:
- Explain this block's purpose or implementation
- Modify or regenerate the block with different tech choices
- Change the tech stack for this block
- Understand how it connects to other blocks

Always respond with a JSON object in this format:
{
  "action": "regenerate_block" | "explain" | "modify_plan",
  "message": "Your text explanation/answer here. Format with markdown if needed.",
  "updatedBlock": null or { ...updated blockJson fields if suggesting/applying changes... },
  "affectedBlocks": [],
  "suggestions": null or [
    { "id": "A", "label": "Option A: [short description]", "prompt": "User prompt to send if selected (e.g. 'Use vanilla HTML and JS')" },
    { "id": "B", "label": "Option B: [short description]", "prompt": "User prompt to send if selected" },
    { "id": "C", "label": "Option C: [short description]", "prompt": "User prompt to send if selected" }
  ],
  "canRegenerate": true/false (set to true if changes can be generated/applied using the 'updatedBlock' payload)
}

For example, if the user asks to change the tech stack (e.g. from React to basic HTML), explain the pros/cons in 'message', provide the modified block details in 'updatedBlock', set 'canRegenerate' to true, and suggest 2-3 options (A, B, C) for different stacks or approaches in 'suggestions'.

You MUST return a valid, parseable JSON object. Do not output any text before or after the JSON.`

    // Build conversation messages (trim to last 20 for context window)
    const recentHistory = chatHistory.slice(-20).map((m: any) => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content as string,
    }))
    const anthropicMessages = [...recentHistory, { role: 'user' as const, content: message }]

    let aiContent = ''
    try {
      aiContent = await askLLM(systemPrompt, anthropicMessages, {
        model: process.env.CLAUDE_PLAN_MODEL ?? 'claude-haiku-4-5-20251001',
      })
    } catch (err: any) {
      console.error('[blocks/chat] askLLM failed:', err.message)
      return reply.code(502).send({
        error: 'AI request failed',
        code: 'all_providers_failed',
        details: err.message,
        status: 502,
        hint: 'Check that the backend is running and ANTHROPIC_API_KEY is set correctly.',
        timestamp: new Date().toISOString(),
      })
    }

    // Try to parse as structured response
    let parsed: {
      action?: string
      message?: string
      updatedBlock?: any
      affectedBlocks?: string[]
      suggestions?: { id: string; label: string; prompt: string }[]
      canRegenerate?: boolean
    } = {}
    let responseText = aiContent
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
        responseText = parsed.message ?? aiContent
      }
    } catch { /* plain text response */ }

    // Persist both messages if projectId provided
    const resolvedProjectId = projectId ?? block.projectId
    if (resolvedProjectId) {
      await prisma.blockChat.create({
        data: { blockId, projectId: resolvedProjectId, role: 'user', content: message },
      })
      const hasMetadata = parsed.action || parsed.suggestions || parsed.canRegenerate
      await prisma.blockChat.create({
        data: {
          blockId,
          projectId: resolvedProjectId,
          role: 'assistant',
          content: responseText,
          metadata: hasMetadata ? {
            action: parsed.action ?? 'explain',
            updatedBlock: parsed.updatedBlock ?? null,
            affectedBlocks: parsed.affectedBlocks ?? [],
            suggestions: parsed.suggestions ?? null,
            canRegenerate: parsed.canRegenerate ?? (parsed.action === 'regenerate_block' || !!parsed.updatedBlock),
          } : undefined,
        },
      })
    }

    // If block should be updated, apply it + trigger cascade regen
    if (parsed.action === 'regenerate_block' && parsed.updatedBlock) {
      const merged = { ...blockJson, ...parsed.updatedBlock }
      await prisma.block.update({
        where: { id: blockId },
        data: { blockJson: merged as any },
      })

      // ── Cascade Regeneration ─────────────────────────────────────────────
      // Non-blocking: find downstream blocks and re-queue them
      const effectiveProjectId = resolvedProjectId
      if (effectiveProjectId) {
        triggerCascadeRegen({
          projectId: effectiveProjectId,
          triggeredBlockId: blockId,
          triggeredBlock: block,
          mergedBlockJson: merged,
          prompt: message,
        }).catch(err => console.error('[blocks/chat] Cascade regen failed:', err))
      }
    }

    return reply.send({
      action: parsed.action ?? 'explain',
      message: responseText,
      updatedBlock: parsed.updatedBlock ?? null,
      affectedBlocks: parsed.affectedBlocks ?? [],
      suggestions: parsed.suggestions ?? null,
      canRegenerate: parsed.canRegenerate ?? (parsed.action === 'regenerate_block' || parsed.updatedBlock ? true : false),
    })
  })

  /** DELETE block */
  app.delete('/:id', { preHandler: verifyClerk }, async (req: FastifyRequest, reply) => {
    const clerkId = req.user.sub
    await getOrCreateUser(clerkId)
    const { id } = req.params as { id: string }

    const block = await prisma.block.findUnique({ where: { id }, select: { projectId: true } })
    await prisma.block.delete({ where: { id } })

    if (block) {
      emitBlockDeleted(block.projectId, id, clerkId).catch(
        err => console.error('[blocks] emitBlockDeleted failed:', err)
      )
    }
    return reply.code(204).send()
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Cascade Regeneration helper — called non-blocking after regenerate_block
// ─────────────────────────────────────────────────────────────────────────────

interface CascadeRegenParams {
  projectId: string
  triggeredBlockId: string
  triggeredBlock: { id: string; blockType: string; blockJson: unknown }
  mergedBlockJson: Record<string, unknown>
  prompt: string
}

async function triggerCascadeRegen({
  projectId,
  triggeredBlockId,
  triggeredBlock,
  mergedBlockJson,
  prompt,
}: CascadeRegenParams): Promise<void> {
  // ── 1. Find all downstream blocks in topological order ───────────────────
  const { affectedIds, orderedIds } = await findDownstreamCascade(projectId, triggeredBlockId)

  if (orderedIds.length === 0) {
    console.log(`[cascade] No downstream blocks to regenerate for block=${triggeredBlockId}`)
    return
  }

  // ── 2. Fetch full block records for the affected blocks ──────────────────
  const affectedBlocks = await prisma.block.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true, blockType: true, blockJson: true },
  })
  const blockMap = new Map(affectedBlocks.map(b => [b.id, b]))

  // ── 3. Find the user who owns this project (needed for WorkflowRun) ──────
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { createdByUserId: true, team: { select: { members: { select: { userId: true }, take: 1 } } } },
  })
  const userId =
    project?.createdByUserId ??
    project?.team?.members?.[0]?.userId

  if (!userId) {
    console.warn(`[cascade] Cannot find a user for project=${projectId} — skipping cascade WorkflowRun`)
    return
  }

  // ── 4. Create a dedicated cascade WorkflowRun ────────────────────────────
  const cascadeRun = await prisma.workflowRun.create({
    data: {
      projectId,
      triggeredByUserId: userId,
      prompt: `[cascade] Downstream regen after block ${triggeredBlockId} was modified via chat: ${prompt}`,
      status: 'running',
      sharedContextJson: {
        cascadeSource: triggeredBlockId,
        mergedBlockJson: mergedBlockJson as InputJsonValue,
        triggeredAt: new Date().toISOString(),
      } as InputJsonValue,
    },
  })

  // ── 5. Create pending_regen BlockOutput records + enqueue BullMQ jobs ────
  //   We build a small delay so downstream blocks wait for their dependencies.
  //   BullMQ delay is 0ms for the first block, 500ms × index for later ones
  //   (a simple approximation — real ordering is enforced by job data).

  for (let i = 0; i < orderedIds.length; i++) {
    const depBlockId = orderedIds[i]
    const depBlock = blockMap.get(depBlockId)
    if (!depBlock) continue

    const depBlockJson = depBlock.blockJson as Record<string, unknown>

    // Create a BlockOutput stamped as pending_regen so the canvas can render it
    await prisma.blockOutput.create({
      data: {
        runId: cascadeRun.id,
        blockId: depBlockId,
        blockType: depBlock.blockType,
        outputCode: '',
        status: 'pending_regen',
      },
    })

    // Collect the IDs of this block's direct dependencies so the worker can
    // inject their freshly-generated outputs as cross-block context.
    // We read deps from blockJson.dependencies[] (array of block_ids / blockIds)
    const rawDeps: unknown[] = (depBlockJson?.dependencies as unknown[]) ?? []
    const depBlockIds: string[] = rawDeps
      .map(d => {
        if (typeof d === 'string') return d
        if (typeof d === 'object' && d !== null) {
          return (d as Record<string, unknown>)['block_id'] as string
            ?? (d as Record<string, unknown>)['blockId'] as string
            ?? null
        }
        return null
      })
      .filter((id): id is string => typeof id === 'string' && id.length > 0)

    // Enqueue the job — cascadeRegen=true tells the worker to load dep outputs
    await blockGenerationQueue.add(
      depBlock.blockType,
      {
        blockId: depBlockId,
        projectId,
        blockType: depBlock.blockType,
        blockJson: depBlockJson,
        prompt,
        runId: cascadeRun.id,
        sharedContext: {},
        cascadeRegen: true,
        depBlockIds,         // worker uses these to inject fresh outputs as context
      },
      {
        // Stagger jobs slightly to allow dependency ordering in the queue
        delay: i * 500,
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
      },
    )
  }

  // ── 6. Broadcast cascade_regen event to all canvas clients ───────────────
  broadcastToProject(projectId, {
    type: 'cascade_regen',
    blockIds: affectedIds,
    order: orderedIds,
    runId: cascadeRun.id,
    triggeredBy: triggeredBlockId,
  })

  console.log(
    `[cascade] Enqueued ${orderedIds.length} downstream blocks for runId=${cascadeRun.id} ` +
    `project=${projectId} triggered=${triggeredBlockId}`,
  )
}

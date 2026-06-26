/**
 * Workflow route — sequential block-by-block generation.
 * Calls the agent service directly for each block, pauses for user confirmation,
 * and broadcasts WebSocket events to the frontend.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import Anthropic from '@anthropic-ai/sdk'
import prisma from '../lib/prisma'
import { verifyClerk } from "../middleware/clerkAuth"
import { getOrCreateUser } from "../lib/getOrCreateUser"
import { broadcastToProject } from '../ws/wsManager'
import { emitWorkflowStarted, emitWorkflowCompleted } from '../graph/graphEvents'
import { graphRegistry } from '../graph/graphEngine'
import { runAbortControllers } from '../lib/runControllers'

async function callLLMForCode(
  systemPrompt: string,
  userMessage: string,
  agentUrl: string,
  agentPayload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ text: string; tokens: number }> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim()

  // Primary: Anthropic Claude Haiku (if key is available)
  if (anthropicKey) {
    try {
      const anthropic = new Anthropic({ apiKey: anthropicKey })
      const model = process.env.CLAUDE_CODE_MODEL ?? 'claude-haiku-4-5-20251001'
      const response = await anthropic.messages.create(
        {
          model,
          max_tokens: 8192,
          temperature: 0.2 as any,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        },
        { timeout: 90_000, signal }
      )
      const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
      const tokens = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0)
      if (text.trim()) {
        console.log(`[workflow] [CLAUDE] Code gen success — ${text.length} chars`)
        return { text, tokens }
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted) throw err
      console.warn(`[workflow] [CLAUDE] Failed, falling back to agents service: ${err.message}`)
    }
  }

  // Fallback: agents service (has its own Groq/OpenRouter/Gemini cascade)
  console.log(`[workflow] [AGENTS] Calling ${agentUrl}/api/v1/generate/`)

  // Combine the 90s timeout with the cancellation signal if both exist
  const timeoutSignal = AbortSignal.timeout(90_000)
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal

  const agentRes = await fetch(`${agentUrl}/api/v1/generate/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agentPayload),
    signal: combinedSignal,
  })
  if (!agentRes.ok) {
    const err = await agentRes.text()
    throw new Error(`Agents service ${agentRes.status}: ${err.slice(0, 300)}`)
  }
  const agentData = await agentRes.json() as { output_code: string; tokens_used: number }
  return { text: agentData.output_code, tokens: agentData.tokens_used ?? 0 }
}

const RunWorkflowSchema = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(2),
  fallbackBlocks: z.array(z.any()).optional(),
})

const ConfirmBlockSchema = z.object({
  projectId: z.string().uuid(),
  runId: z.string().uuid(),
})

const ApprovalSchema = z.object({
  projectId: z.string().uuid(),
  runId: z.string().uuid(),
})

// Per-block concurrency guard: prevents duplicate generateBlock calls for the same block
const activeGenerations = new Set<string>()

// Helper function to generate a single block asynchronously
async function generateBlock(runId: string, projectId: string, blockId: string, blockType: string, blockJson: any, prompt: string) {
  const generationKey = `${runId}:${blockId}`

  // Skip if this exact block is already being generated (concurrent processReadyBlocks calls)
  if (activeGenerations.has(generationKey)) {
    console.log(`[workflow] [SKIP] Block ${blockType} (${blockId}) already generating — skipping duplicate call`)
    return
  }
  activeGenerations.add(generationKey)

  // Register a per-run AbortController so /stop can cancel this fetch
  if (!runAbortControllers.has(runId)) {
    runAbortControllers.set(runId, new AbortController())
  }
  const controller = runAbortControllers.get(runId)!
  const signal = controller.signal

  // Notify frontend: starting
  broadcastToProject(projectId, {
    event: 'block:status_update',
    blockId,
    status: 'running',
    runId,
  })

  // blockOutput id reference — set inside try so catch can safely skip update if setup failed
  let blockOutputId: string | null = null

  const agentUrl = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8000'
  let outputCode = ''

  try {
    // ── DB SETUP — inside try so any DB error is properly caught and surfaces as 'failed' ──
    let existingOutput = await prisma.blockOutput.findFirst({ where: { runId, blockId } })
    if (!existingOutput) {
      existingOutput = await prisma.blockOutput.create({
        data: { runId, blockId, blockType, outputCode: '', status: 'running' }
      })
    } else {
      await prisma.blockOutput.update({ where: { id: existingOutput.id }, data: { status: 'running' } })
    }
    blockOutputId = existingOutput.id

    // ── CROSS-BLOCK CONTEXT ───────────────────────────────────────────────────
    let dependencyContext = ''
    try {
      const depBlockIds: string[] = blockJson?.dependencies ?? []
      if (depBlockIds.length > 0) {
        const completedOutputs = await prisma.blockOutput.findMany({
          where: { runId, blockId: { in: depBlockIds }, status: 'done' },
          select: { blockId: true, blockType: true, outputCode: true },
        })
        if (completedOutputs.length > 0) {
          const sections = completedOutputs.map(o =>
            `--- DEPENDENCY: ${o.blockType} (${o.blockId}) ---\n${o.outputCode.slice(0, 3000)}\n--- END DEPENDENCY ---`
          )
          dependencyContext = `\n\nDEPENDENCY_CONTEXT (already generated code from upstream blocks — use correct imports and types):\n${sections.join('\n\n')}`
          console.log(`[workflow] [CONTEXT] Injecting ${completedOutputs.length} dependency outputs for block ${blockId}`)
        }
      }
    } catch (ctxErr: any) {
      console.warn(`[workflow] [CONTEXT] Failed to load dependency context:`, ctxErr.message)
    }
    // ─────────────────────────────────────────────────────────────────────────

    console.log(`[workflow] [GENERATING] ${blockType} (${blockId})`)
    // Sanitize files: agent expects {path, description} objects, not raw strings
    const sanitizeFiles = (arr: any[], fallbackTitle: string): { path: string; description: string }[] => {
      const files = (arr ?? []).map((f) =>
        typeof f === 'string'
          ? { path: f, description: `Implementation of ${fallbackTitle}` }
          : { path: f?.path ?? `${fallbackTitle.toLowerCase().replace(/\s+/g, '_')}/index.ts`, description: f?.description ?? `Main implementation` }
      )
      return files.length > 0
        ? files
        : [{ path: `${fallbackTitle.toLowerCase().replace(/\s+/g, '_')}/index.ts`, description: `Main implementation of ${fallbackTitle}` }]
    }

    const blockTitle = blockJson?.title ?? blockJson?.name ?? blockType

    const sanitizedFiles = sanitizeFiles(blockJson?.files, blockTitle)
    const logicSteps = (blockJson?.acceptance_criteria ?? []).filter((c: any) => typeof c === 'string')

    console.log(`[workflow] [GENERATING VIA CLAUDE] block=${blockTitle} stack=${blockJson?.stack} files=${JSON.stringify(sanitizedFiles)}`)

    // Infer stack from user prompt if blockJson.stack is empty
    const inferredStack = ((): string => {
      const s = (blockJson?.stack ?? '').trim()
      if (s) return s
      const p = prompt.toLowerCase()
      if (p.includes('next.js') || p.includes('nextjs')) return 'Next.js + TypeScript'
      if (p.includes('vue')) return 'Vue 3 + TypeScript'
      if (p.includes('angular')) return 'Angular + TypeScript'
      if (p.includes('react')) return 'React + TypeScript'
      if (p.includes('python') || p.includes('django') || p.includes('flask') || p.includes('fastapi')) return 'Python'
      if (p.includes('go') || p.includes('golang')) return 'Go'
      if (p.includes('java') || p.includes('spring')) return 'Java + Spring Boot'
      if (p.includes('ruby') || p.includes('rails')) return 'Ruby on Rails'
      if (p.includes('php') || p.includes('laravel')) return 'PHP + Laravel'
      return 'TypeScript'
    })()

    const systemPrompt = `You are a senior software engineer generating production-ready code for a Vite + React 18 + TypeScript project.

═══════════════════════════════════════════════════
TECH STACK (use ONLY these — never import anything else):
- React 18 + TypeScript (tsx files)
- Tailwind CSS (utility classes — use className="...")
- lucide-react (icons — e.g. import { Search, X } from 'lucide-react')
- framer-motion (animations)
- react-router-dom v6 (routing)
- clsx + tailwind-merge via cn() helper
- class-variance-authority (CVA for variants)
- zod (validation)
- react-hook-form (forms)
- date-fns (date utilities)
- recharts (charts)
- axios (HTTP calls)
- zustand (global state if needed)

UTILITY: The file src/lib/utils.ts already exists with this content:
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

Use cn() for conditional class names. Import it: import { cn } from '../lib/utils'

RULES FOR COMPONENTS:
- Every component file MUST have: export default function ComponentName()
- Use TypeScript interfaces for all props — no 'any' types
- Loading state, error state, and empty state in every data-fetching component
- Use Tailwind classes for all styling — no inline style objects
- Use lucide-react for ALL icons — never use emoji as icons

═══════════════════════════════════════════════════
CRITICAL OUTPUT FORMAT — follow exactly, no exceptions:

1. Every single file MUST start with this exact comment on its own line:
   // FILE: src/path/to/filename.tsx
2. Use EXACT paths from CODE GENERATION PLAN below — do NOT invent paths.
3. Generate ALL listed files. Do NOT skip any.
4. NO markdown code fences (no \`\`\`typescript or \`\`\`). Raw code only.
5. NO placeholder comments ("// TODO", "// implement later", "// add logic here").
   Every function MUST have a complete working implementation.
6. Every component must export default. Every utility must export named functions.
7. Separate files with exactly one blank line after the last line of code.

CORRECT FORMAT EXAMPLE:
// FILE: src/components/SearchBar.tsx
import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
}

export default function SearchBar({ placeholder = 'Search...', onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const clear = () => { setQuery(''); onSearch(''); };
  return (
    <div className="relative flex items-center w-full max-w-md">
      <Search className="absolute left-3 text-gray-400" size={18} />
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onSearch(e.target.value); }}
        placeholder={placeholder}
        className={cn('w-full pl-10 pr-8 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500', query && 'pr-10')}
      />
      {query && <button onClick={clear} className="absolute right-3 text-gray-400 hover:text-gray-600"><X size={16} /></button>}
    </div>
  );
}`

    const filesPlan = sanitizedFiles.map((f: { path: string; description: string }) => `- ${f.path}: ${f.description}`).join('\n')
    const logicList = logicSteps.length > 0
      ? logicSteps.map((s: string) => `- ${s}`).join('\n')
      : `- Implement the ${blockTitle} module with full functionality`

    const userMessage = `Generate production-ready code for: ${blockTitle} (${blockType})

PROJECT CONTEXT: ${prompt}${dependencyContext}
BLOCK PURPOSE: ${blockJson?.description ?? `Generate ${blockType} module`}
STACK: ${inferredStack}

INTERNAL EXECUTION LOGIC (MANDATORY):
${logicList}

CODE GENERATION PLAN — generate ALL of these files:
${filesPlan}

REMINDER: Start EVERY file with // FILE: <exact path from the plan above>. No markdown fences. No placeholders.`

    // Build the original agent payload as fallback (used if Anthropic key not set)
    const sanitizeIO = (arr: any[]): { name: string; type: string; source: string }[] =>
      (arr ?? []).map((item) =>
        typeof item === 'string'
          ? { name: item, type: 'any', source: 'external' }
          : { name: item?.name ?? 'field', type: item?.type ?? 'any', source: item?.source ?? 'external' }
      )
    const agentPayload = {
      executionId: runId,
      project_prompt: prompt + dependencyContext,
      block: {
        block_id: blockId,
        block_name: blockTitle,
        block_type: blockType,
        purpose: blockJson?.description ?? `Generate ${blockType} module`,
        inputs: sanitizeIO(blockJson?.inputs),
        outputs: sanitizeIO(blockJson?.outputs),
        dependencies: (blockJson?.dependencies ?? []).filter((d: any) => typeof d === 'string'),
        internal_logic: logicSteps.length > 0 ? logicSteps : [`Implement the ${blockTitle} module with full functionality`],
        code_generation_plan: { stack: blockJson?.stack ?? 'TypeScript/Node.js', files: sanitizedFiles },
        api_spec: blockJson?.api_spec ?? null,
        preview_behavior: blockJson?.preview_behavior ?? null,
      },
    }

    const { text, tokens: tokensUsed } = await callLLMForCode(systemPrompt, userMessage, agentUrl, agentPayload, signal)
    outputCode = text

    if (!outputCode.trim()) {
      throw new Error('LLM returned empty response for block generation')
    }

    // Update DB to done
    await prisma.blockOutput.update({
      where: { id: blockOutputId },
      data: { outputCode, tokensUsed, status: 'done' },
    })

    console.log(`[workflow] ✅ Block ${blockType} completed — ${outputCode.length} chars`)

    // Notify frontend: done
    broadcastToProject(projectId, {
      event: 'block:status_update',
      blockId,
      status: 'done',
      output: outputCode,
      runId,
    })

    // 🔄 TRIGGER SCHEDULER: Check if children are now ready
    processReadyBlocks(runId, projectId).catch(e => console.error("[workflow] Scheduler error:", e))

  } catch (err: any) {
    const wasStopped = signal.aborted
    const errMsg = wasStopped ? 'Stopped by user' : (err.message || 'Unknown error')
    console.error(`[workflow] ❌ Block ${blockType} ${wasStopped ? 'stopped' : 'failed'}:`, errMsg)

    if (blockOutputId) {
      await prisma.blockOutput.update({
        where: { id: blockOutputId },
        data: { outputCode: '', status: wasStopped ? ('stopped' as any) : 'failed', errorMsg: errMsg },
      }).catch(() => {})
    } else {
      // Setup failed before blockOutput was created — try to update by blockId+runId
      await prisma.blockOutput.updateMany({
        where: { runId, blockId },
        data: { status: 'failed', errorMsg: errMsg },
      }).catch(() => {})
    }

    broadcastToProject(projectId, {
      event: 'block:status_update',
      blockId,
      status: wasStopped ? 'stopped' : 'failed',
      error: errMsg,
      runId,
    })
  } finally {
    // Release concurrency guard
    activeGenerations.delete(generationKey)
    // Clean up controller once this block finishes
    if (runAbortControllers.get(runId) === controller) {
      runAbortControllers.delete(runId)
    }
  }
}

/**
 * processReadyBlocks — The Scheduler
 * Identifies the next 'approved' block whose dependencies are 'done' and triggers it.
 * Uses project-wide "done" status so blocks generated in earlier runs satisfy dependencies.
 * Only triggers ONE block at a time to enforce sequential generation.
 */
async function processReadyBlocks(runId: string, projectId: string) {
  console.log(`[workflow] [SCHEDULER] Checking for ready blocks in run ${runId}`)

  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { blockOutputs: true }
  })
  if (!run || run.status === 'done' || run.status === 'failed') return

  const projectBlocks = await prisma.block.findMany({ where: { projectId } })
  const connections = await prisma.connection.findMany({ where: { projectId } })

  // Current run's output status per block
  const outputMap = new Map(run.blockOutputs.map(o => [o.blockId, o.status]))
  // Map blockId → BlockOutput record (for updatedAt staleness check)
  const outputRecordMap = new Map(run.blockOutputs.map(o => [o.blockId, o]))

  // Project-wide "done" set — looks across ALL runs so earlier runs count for dependency checks.
  // This fixes the case where a new run is created but block 1 was done in a previous run.
  const doneAnywhere = await prisma.blockOutput.findMany({
    where: { block: { projectId }, status: 'done' },
    select: { blockId: true },
  })
  const doneBlockIds = new Set(doneAnywhere.map(o => o.blockId))

  let nextBlock: (typeof projectBlocks)[0] | null = null

  for (const block of projectBlocks) {
    const status = outputMap.get(block.id)

    // Only process if user has APPROVED this block in this run and it's not already running/done
    if (status !== 'approved') continue

    // Check dependencies using project-wide "done" set
    const dependencies = connections.filter(c => c.toBlockId === block.id)
    const allDepsDone = dependencies.every(d => doneBlockIds.has(d.fromBlockId))

    if (allDepsDone) {
      nextBlock = block
      break // one at a time — process only the first ready block
    }
  }

  // ── Stale-approved safety net ─────────────────────────────────────────────
  // If no nextBlock was found via approved→ready path, check for blocks that have been
  // 'approved' for > 5 minutes without being picked up (e.g. after a server restart or
  // dropped WS). Re-trigger generation for the first stale approved block.
  if (!nextBlock) {
    const STALE_THRESHOLD_MS = 30 * 1000 // 30 seconds — re-trigger stale approved blocks quickly
    const now = Date.now()
    for (const block of projectBlocks) {
      const status = outputMap.get(block.id)
      if (status !== 'approved') continue
      const record = outputRecordMap.get(block.id)
      if (!record) continue
      const ageMs = now - new Date(record.updatedAt).getTime()
      if (ageMs > STALE_THRESHOLD_MS) {
        console.log(`[workflow] [SCHEDULER] Stale approved block detected (${ageMs}ms): ${block.id} — re-triggering`)
        nextBlock = block
        break
      }
    }
  }

  if (!nextBlock) {
    // Check if everything is finished in this run
    const allFinished = projectBlocks.every(b => {
        const s = outputMap.get(b.id)
        return s === 'done' || s === 'skipped' || s === 'failed'
    })

    if (allFinished && projectBlocks.length > 0) {
      console.log(`[workflow] [SCHEDULER] All blocks finished. Workflow DONE.`)
      await prisma.workflowRun.update({
        where: { id: runId },
        data: { status: 'done' }
      })
      broadcastToProject(projectId, { event: 'workflow:completed', runId })
      emitWorkflowCompleted(projectId, runId).catch(() => {})
    }
    return
  }

  console.log(`[workflow] [SCHEDULER] Triggering block: ${nextBlock.blockType} (${nextBlock.id})`)
  generateBlock(runId, projectId, nextBlock.id, nextBlock.blockType, nextBlock.blockJson, run.prompt)
    .catch(e => console.error('[workflow] Block generation error:', e))
}

export async function workflowRoutes(app: FastifyInstance) {

  // ✅ GET all runs for a project — filtered by the authenticated user
  app.get('/runs', { preHandler: verifyClerk }, async (req: any, reply) => {
    const clerkId = req.user.sub
    const user = await getOrCreateUser(clerkId)
    const { projectId } = req.query as { projectId?: string }
    if (!projectId) return reply.code(400).send({ error: 'projectId is required' })

    const runs = await prisma.workflowRun.findMany({
      where: {
        projectId,
        triggeredByUserId: user.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        blockOutputs: {
          select: {
            id: true,
            blockId: true,
            blockType: true,
            status: true,
            tokensUsed: true,
            errorMsg: true,
            createdAt: true,
            // outputCode intentionally excluded — can be megabytes, not needed for status display
          },
          orderBy: { createdAt: 'asc' },
        }
      }
    })

    return runs
  })

  /** POST /api/workflow/run — Staging Phase: Create outputs for ALL blocks */
  app.post('/run', { preHandler: verifyClerk }, async (req: any, reply) => {
    const clerkId = req.user.sub
    const user = await getOrCreateUser(clerkId)

    const parsed = RunWorkflowSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(422).send({ error: parsed.error.flatten() })

    const { projectId, prompt, fallbackBlocks } = parsed.data
    console.log(`[workflow] [STAGING STARTED] for project ${projectId}`)

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return reply.code(404).send({ error: 'Project not found' })

    let blocks = await prisma.block.findMany({ where: { projectId } })
    
    // If DB is empty, use the fallbackBlocks passed from the frontend canvas
    if (blocks.length === 0 && fallbackBlocks && fallbackBlocks.length > 0) {
      console.log(`[workflow] DB blocks empty, saving ${fallbackBlocks.length} fallbackBlocks`)
      // Clean up just in case
      await prisma.block.deleteMany({ where: { projectId } })
      
      for (const b of fallbackBlocks) {
        try {
          await prisma.block.create({
            data: {
              projectId,
              blockType: b.blockType ?? 'ui',
              blockJson: b.blockJson ?? {}
            }
          })
        } catch (e) {
          console.error("[workflow] Failed to insert fallback block", e)
        }
      }
      blocks = await prisma.block.findMany({ where: { projectId } })
    }

    if (blocks.length === 0) {
      return reply.code(400).send({ error: 'No blocks found. Please generate a plan first.' })
    }

    // Create a workflow run record
    const run = await prisma.workflowRun.create({
      data: { 
        projectId, 
        prompt, 
        status: 'pending', // Use pending until approval starts
        sharedContextJson: {},
        triggeredByUserId: user.id 
      },
    })

    // Find all previously successful block outputs to carry them over
    const successfulOutputs = await prisma.blockOutput.findMany({
      where: {
        blockId: { in: blocks.map(b => b.id) },
        status: 'done'
      },
      orderBy: { createdAt: 'desc' }
    })
    
    const prevDoneBlocks = new Map<string, any>()
    for (const out of successfulOutputs) {
      if (!prevDoneBlocks.has(out.blockId)) {
        prevDoneBlocks.set(out.blockId, out)
      }
    }

    // STAGE ALL BLOCKS as pending_approval (or done if already completed in a prior run)
    await prisma.blockOutput.createMany({
      data: blocks.map(b => {
        const prev = prevDoneBlocks.get(b.id)
        if (prev) {
          return {
            runId: run.id,
            blockId: b.id,
            blockType: b.blockType,
            outputCode: prev.outputCode,
            status: 'done' as any
          }
        }
        return {
          runId: run.id,
          blockId: b.id,
          blockType: b.blockType,
          outputCode: '',
          status: 'pending_approval' as any
        }
      })
    })

    // Log the staging event
    await prisma.eventLog.create({
      data: {
        projectId,
        eventType: 'WORKFLOW_STARTED',
        payload: { runId: run.id, blockCount: blocks.length, prompt },
        triggeredBy: user.id
      }
    }).catch(() => {})

    console.log(`[workflow] [STAGING COMPLETE] ${blocks.length} blocks staged for approval.`)

    const responseBody = {
      documentation: project.planDoc || '',
      blocks: blocks.map(b => ({
        id: b.id,
        type: b.blockType,
        title: (b.blockJson as any)?.title || b.blockType,
        description: (b.blockJson as any)?.description || ''
      })),
      graph: (() => {
        try {
          return project.planDoc ? JSON.parse(project.planDoc) : { nodes: [], edges: [] };
        } catch (e) {
          return { nodes: [], edges: [] }; // Fallback if planDoc is Markdown instead of JSON
        }
      })(),
      executionId: run.id
    }

    // Respond immediately. Code generation ONLY starts after user approves.
    reply.code(202).send(responseBody)
    emitWorkflowStarted(projectId, run.id, user.id).catch(() => {})
  })

  /** POST /api/workflow/approve/:blockId — marks block approved, triggers scheduler */
  app.post('/approve/:blockId', { preHandler: verifyClerk }, async (req: any, reply) => {
    const clerkId = req.user.sub
    const user = await getOrCreateUser(clerkId)

    const { blockId } = req.params
    const parsed = ApprovalSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(422).send({ error: parsed.error.flatten() })

    const { projectId, runId } = parsed.data

    // Verify block exists in the project
    const block = await prisma.block.findFirst({ where: { id: blockId, projectId } })
    if (!block) return reply.code(404).send({ error: `Block ${blockId} not found in project` })

    // Self-healing: ensure the run exists, create it if needed
    let activeRunId = runId
    const existingRun = await prisma.workflowRun.findUnique({ where: { id: runId } })
    if (!existingRun) {
      console.log(`[workflow] Run ${runId} not found — creating fresh run`)
      const newRun = await prisma.workflowRun.create({
        data: { projectId, prompt: 'Auto-created for approval', status: 'pending', sharedContextJson: {}, triggeredByUserId: user.id }
      })
      activeRunId = newRun.id
    }

    // Self-healing: ensure BlockOutput exists (upsert instead of 404)
    let blockOutput = await prisma.blockOutput.findFirst({ where: { blockId, runId: activeRunId } })
    if (!blockOutput) {
      console.log(`[workflow] BlockOutput not found — auto-creating for block ${blockId}`)
      blockOutput = await prisma.blockOutput.create({
        data: { runId: activeRunId, blockId, blockType: block.blockType, outputCode: '', status: 'pending_approval' as any }
      })
    }

    // Mark as approved
    await prisma.blockOutput.update({
      where: { id: blockOutput.id },
      data: { status: 'approved' as any }
    })

    console.log(`[workflow] 👍 Block ${blockId} APPROVED by user.`)

    // Notify frontend
    broadcastToProject(projectId, {
        event: 'block:status_update',
        blockId,
        status: 'approved',
        runId: activeRunId,
    })

    await prisma.eventLog.create({
      data: {
        projectId,
        eventType: 'BLOCK_UPDATED',
        payload: { blockId, runId: activeRunId, action: 'APPROVED' },
        triggeredBy: user.id
      }
    }).catch(() => {})

    // Ensure run is in running state
    await prisma.workflowRun.update({
        where: { id: activeRunId },
        data: { status: 'running' }
    }).catch(() => {})

    // 🚀 Trigger scheduler
    processReadyBlocks(activeRunId, projectId).catch(e => console.error(e))

    return { status: 'approved', runId: activeRunId }
  })


  /** POST /api/workflow/reject/:blockId or /skip/:blockId — skips block */
  const skipHandler = async (req: any, reply: any) => {
    const user = await getOrCreateUser(req.user.sub)
    const { blockId } = req.params
    const { projectId, runId } = req.body as any

    // Self-heal: find or create block output
    let blockOutput = await prisma.blockOutput.findFirst({ where: { blockId, runId } })
    if (!blockOutput) {
      const block = await prisma.block.findFirst({ where: { id: blockId, projectId } })
      if (!block) return reply.code(404).send({ error: `Block ${blockId} not found` })
      blockOutput = await prisma.blockOutput.create({
        data: { runId, blockId, blockType: block.blockType, outputCode: '', status: 'skipped' as any }
      })
    } else {
      await prisma.blockOutput.update({ where: { id: blockOutput.id }, data: { status: 'skipped' as any } })
    }

    console.log(`[workflow] ⏭️ Block ${blockId} SKIPPED by user.`)
    broadcastToProject(projectId, { event: 'block:status_update', blockId, status: 'skipped', runId })
    await prisma.eventLog.create({
      data: { projectId, eventType: 'BLOCK_UPDATED', payload: { blockId, runId, action: 'SKIPPED' }, triggeredBy: user.id }
    }).catch(() => {})
    processReadyBlocks(runId, projectId).catch(e => console.error(e))
    return { status: 'skipped' }
  }

  app.post('/reject/:blockId', { preHandler: verifyClerk }, skipHandler)
  app.post('/skip/:blockId',  { preHandler: verifyClerk }, skipHandler)


  // ✅ GET single run by ID — includes full outputCode, use for code viewing only
  app.get('/runs/:id', { preHandler: verifyClerk }, async (req: any, reply) => {
    const clerkId = req.user.sub
    const user = await getOrCreateUser(clerkId)

    const run = await prisma.workflowRun.findFirst({
      where: {
        id: req.params.id,
        triggeredByUserId: user.id,
      },
      include: {
        blockOutputs: {
          orderBy: { createdAt: 'asc' },
        }
      },
    })

    if (!run) return reply.code(404).send({ error: 'Workflow not found' })
    return run
  })

  // ✅ GET lightweight status-only poll endpoint — no outputCode, safe to call every 3s
  app.get('/runs/:id/status', { preHandler: verifyClerk }, async (req: any, reply) => {
    const clerkId = req.user.sub
    const user = await getOrCreateUser(clerkId)

    const run = await prisma.workflowRun.findFirst({
      where: { id: req.params.id, triggeredByUserId: user.id },
      select: {
        id: true,
        status: true,
        blockOutputs: {
          select: { blockId: true, status: true },
          orderBy: { createdAt: 'asc' },
        }
      },
    })

    if (!run) return reply.code(404).send({ error: 'Workflow not found' })
    return run
  })

  // ✅ PATCH /runs/:id/status — update run status
  app.patch('/runs/:id/status', { preHandler: verifyClerk }, async (req: any, reply) => {
    const clerkId = req.user.sub
    const user = await getOrCreateUser(clerkId)

    const { status } = req.body as { status: string }

    const run = await prisma.workflowRun.findFirst({
      where: { id: req.params.id, triggeredByUserId: user.id }
    })
    if (!run) return reply.code(404).send({ error: 'Run not found' })

    const updated = await prisma.workflowRun.update({
      where: { id: req.params.id },
      data: { status: status as any },
    })

    return updated
  })

  /** POST /api/workflow/stop/:runId — cancel in-flight generation for a run */
  app.post('/stop/:runId', { preHandler: verifyClerk }, async (req: any, reply) => {
    const clerkId = req.user.sub
    const user = await getOrCreateUser(clerkId)
    const { runId } = req.params as { runId: string }

    const run = await prisma.workflowRun.findFirst({
      where: { id: runId, triggeredByUserId: user.id }
    })
    if (!run) return reply.code(404).send({ error: 'Run not found' })

    // Abort any in-flight fetch/LLM calls
    const controller = runAbortControllers.get(runId)
    if (controller) {
      controller.abort()
      runAbortControllers.delete(runId)
      console.log(`[workflow] 🛑 Run ${runId} stopped by user`)
    }

    // Mark all still-running blockOutputs as stopped
    await prisma.blockOutput.updateMany({
      where: { runId, status: { in: ['running', 'approved'] } },
      data: { status: 'failed' as any, errorMsg: 'Stopped by user' },
    })

    // Mark run itself as failed
    await prisma.workflowRun.update({
      where: { id: runId },
      data: { status: 'failed' },
    })

    broadcastToProject(run.projectId, {
      event: 'workflow:stopped',
      runId,
    })

    return { status: 'stopped' }
  })
}
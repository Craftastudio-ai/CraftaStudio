import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { verifyClerk } from '../middleware/clerkAuth'
import prisma from '../lib/prisma'
import { BLOCK_TYPES } from './blocks'

// In-memory job store for async plan generation
// On production with multiple instances, this should use Redis.
// For a single-instance EB deployment this is sufficient.
const planJobs = new Map<string, {
  status: 'processing' | 'done' | 'error';
  result?: any;
  error?: string;
  createdAt: number;
}>()

// Purge jobs older than 10 minutes to prevent memory leaks
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000
  for (const [id, job] of planJobs.entries()) {
    if (job.createdAt < cutoff) planJobs.delete(id)
  }
}, 60_000)

const PlanDocSchema = z.object({
  prompt: z.string().min(2),
  project_name: z.string().optional().default('My Project'),
  projectId: z.string().uuid().optional().nullable(),
  answers: z.record(z.string()).optional(),
})

const OrchestrateSchema = z.object({
  prompt: z.string().min(1),
  projectId: z.string().uuid().optional().nullable().or(z.literal("")),
})

const QuestionsSchema = z.object({
  prompt: z.string().min(2),
})

/** Normalise a free-form title into a lowercase slug (e.g. "Auth Service" → "auth-service"). */
function slugifyTitle(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function planRoutes(app: FastifyInstance) {

  app.get('/debug-agent', async (req: any, reply) => {
    const agentUrl = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8000';
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${agentUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(id);

      const text = await res.text();
      return reply.send({
        agentUrl,
        status: res.status,
        response: text,
      });
    } catch (err: any) {
      return reply.send({
        agentUrl,
        error: err.message,
        stack: err.stack,
      });
    }
  });

  app.post('/orchestrate', { preHandler: verifyClerk }, async (req: any, reply) => {
    const parsed = OrchestrateSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({ error: parsed.error.flatten() })
    }

    const agentUrl = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8000'

    try {
      const agentRes = await fetch(`${agentUrl}/api/v1/orchestrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: parsed.data.prompt,
          projectId: parsed.data.projectId
        }),
        signal: AbortSignal.timeout(60_000),
      })

      if (!agentRes.ok) {
        const err = await agentRes.text()
        console.error('[plan/orchestrate] Agent error:', agentRes.status, err)
        return reply.code(agentRes.status).send({ error: 'Agent service failed', details: err })
      }

      const result = await agentRes.json()
      return reply.send(result)
    } catch (err: any) {
      console.error('[plan/orchestrate] Agent unreachable:', err.message)
      return reply.code(503).send({ error: 'Agent service unavailable', message: err.message })
    }
  })


  app.post('/questions', { preHandler: verifyClerk }, async (req: any, reply) => {
    const parsed = QuestionsSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({ error: parsed.error.flatten() })
    }

    const agentUrl = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8000'

    try {
      const agentRes = await fetch(`${agentUrl}/api/v1/plan/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: parsed.data.prompt }),
        signal: AbortSignal.timeout(30_000),
      })

      if (!agentRes.ok) {
        const err = await agentRes.text()
        console.error('[plan/questions] Agent error:', agentRes.status, err)
        return reply.code(agentRes.status).send({ error: 'Agent service failed', details: err })
      }

      const questions = await agentRes.json()
      return reply.send(questions)
    } catch (err: any) {
      console.error('[plan/questions] Agent unreachable:', err.message)
      return reply.code(503).send({ error: 'Agent service unavailable', message: err.message })
    }
  })

  // We support both /api/plan and /api/plan/generate
  // ── Async generate handler ──────────────────────────────────────────────
  // Returns immediately with { jobId } so nginx/ALB never times out.
  // Actual plan generation runs in the background.
  const generateHandler = async (req: any, reply: any) => {

    const parsed = PlanDocSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({ error: parsed.error.flatten() })
    }

    const agentUrl = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8000'
    const jobId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // ── Kick off background generation (does NOT block HTTP response) ──────
    planJobs.set(jobId, { status: 'processing', createdAt: Date.now() })

    ;(async () => {
      try {
        console.log(`[plan:${jobId}] → ${agentUrl}/api/v1/plan/doc — "${parsed.data.prompt.slice(0, 60)}"`)

        const agentRes = await fetch(`${agentUrl}/api/v1/plan/doc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: parsed.data.prompt,
            project_name: parsed.data.project_name,
            answers: parsed.data.answers,
          }),
          // No AbortSignal — let it run as long as needed
        })

        if (!agentRes.ok) {
          const err = await agentRes.text()
          console.error(`[plan:${jobId}] Agent error:`, agentRes.status, err)
          planJobs.set(jobId, { status: 'error', error: `Agent error ${agentRes.status}: ${err.slice(0, 300)}`, createdAt: Date.now() })
          return
        }

        const plan = await agentRes.json() as any
        console.log(`[plan:${jobId}] Got "${plan.documentation?.title ?? plan.title}" with ${plan.blocks?.length ?? 0} blocks`)

        let savedBlocks: Array<{ dbId: string; blockType: string; idx: number }> = []
        const blockIdMap: Record<string, string> = {}
        const projectId = parsed.data.projectId ?? null
        const validTypes = BLOCK_TYPES

        // SORT BLOCKS: UI/Frontend blocks first, so they generate immediately and show in Preview
        if (Array.isArray(plan.blocks)) {
          plan.blocks.sort((a: any, b: any) => {
            const isAUI = ['ui', 'frontend', 'page'].includes((a.block_type ?? a.type ?? a.layer ?? '').toLowerCase());
            const isBUI = ['ui', 'frontend', 'page'].includes((b.block_type ?? b.type ?? b.layer ?? '').toLowerCase());
            if (isAUI && !isBUI) return -1;
            if (!isAUI && isBUI) return 1;
            return 0;
          });
        }

        if (projectId && plan.blocks?.length > 0) {
          const planMarkdown = plan.documentation?.markdown ?? plan.markdown ?? ''
          await prisma.project.update({ where: { id: projectId }, data: { planDoc: planMarkdown } })
          await prisma.projectDocument.upsert({
            where: { projectId },
            update: { content: planMarkdown },
            create: { projectId, content: planMarkdown, status: 'approved' }
          }).catch((err: any) => console.warn('[plan] Failed to sync ProjectDocument:', err.message))

          await prisma.block.deleteMany({ where: { projectId } })
          await prisma.connection.deleteMany({ where: { projectId } }).catch(() => {})

          for (let i = 0; i < plan.blocks.length; i++) {
            const block = plan.blocks[i]
            const originalId = block.block_id ?? block.id ?? `temp-block-${i}`
            const rawType = slugifyTitle(block.block_type ?? block.blockType ?? block.title ?? block.block_name ?? `block-${i}`)
            const blockType = validTypes.includes(rawType as any) ? rawType : 'ui'
            const rawFiles: any[] = block.code_generation_plan?.files ?? []
            const files: string[] = rawFiles.map((f: any) => typeof f === 'string' ? f : (f?.path ?? f?.description ?? '')).filter(Boolean)
            const stackStr: string = block.code_generation_plan?.stack ?? block.stack ?? ''
            const techStack: string[] = stackStr.split(/[+,]/).map((s: string) => s.trim()).filter(Boolean)
            const endpoints: any[] = block.api_spec?.endpoints ?? []
            const internalLogic: string[] = block.internal_logic ?? []
            const agentDeps: string[] = block.dependencies ?? []
            const blockJson = {
              title: block.block_name ?? block.title ?? rawType,
              stack: stackStr, tech_stack: techStack,
              description: block.purpose ?? block.description ?? '',
              purpose: block.purpose ?? '', responsibilities: block.responsibilities ?? '',
              constraints: block.constraints ?? '', example_use_case: block.example_use_case ?? '',
              inputs: block.inputs ?? [], outputs: block.outputs ?? [],
              status: 'idle', subBlocks: block.subBlocks ?? [],
              originalType: block.block_type ?? block.type ?? 'block',
              files, acceptance_criteria: internalLogic, tech_stack_arr: techStack,
              endpoints, implementation_notes: internalLogic.join('\n'),
              agent_dependencies: agentDeps, dependencies: [], estimated_lines: files.length * 40,
            }
            try {
              const saved = await prisma.block.create({ data: { projectId, blockType, blockJson } })
              blockIdMap[originalId] = saved.id
              savedBlocks.push({ dbId: saved.id, blockType, idx: i })
              console.log(`[plan:${jobId}] Saved block: ${blockType} (${saved.id})`)
            } catch (e: any) {
              console.warn(`[plan:${jobId}] Block save failed (${blockType}):`, e.message)
            }
          }

          const edges = plan.graph?.edges ?? []
          for (const edge of edges) {
            try {
              const dbSourceId = blockIdMap[edge.source ?? edge.from]
              const dbTargetId = blockIdMap[edge.target ?? edge.to]
              if (dbSourceId && dbTargetId) {
                await prisma.connection.create({ data: { projectId, fromBlockId: dbSourceId, toBlockId: dbTargetId, connectionType: edge.type ?? 'dependency' } })
              }
            } catch (err: any) { console.warn(`[plan:${jobId}] Edge save failed:`, err.message) }
          }
          console.log(`[plan:${jobId}] ✅ ${savedBlocks.length}/${plan.blocks.length} blocks saved`)
        }

        // Build enriched response
        const enrichedBlocks = (plan.blocks ?? []).map((b: any, i: number) => {
          const saved = savedBlocks.find(s => s.idx === i)
          const rawFiles: any[] = b.code_generation_plan?.files ?? []
          const files: string[] = rawFiles.map((f: any) => typeof f === 'string' ? f : (f?.path ?? f?.description ?? '')).filter(Boolean)
          const stackStr: string = b.code_generation_plan?.stack ?? b.stack ?? ''
          const techStack: string[] = stackStr.split(/[+,]/).map((s: string) => s.trim()).filter(Boolean)
          return {
            ...b,
            id: saved?.dbId ?? b.block_id ?? b.id,
            blockType: saved?.blockType ?? slugifyTitle(b.block_type ?? b.blockType ?? b.title ?? b.block_name ?? `block-${i}`),
            title: b.block_name ?? b.title ?? `Block ${i + 1}`,
            description: b.purpose ?? b.description ?? '',
            stack: stackStr, type: b.block_type ?? b.type ?? 'service',
            files, tech_stack: techStack,
            acceptance_criteria: b.internal_logic ?? [],
            endpoints: b.api_spec?.endpoints ?? [],
            dependencies: b.dependencies ?? [],
            implementation_notes: (b.internal_logic ?? []).join('\n'),
            estimated_lines: files.length * 40,
          }
        })

        const enrichedGraph = { ...plan.graph }
        if (enrichedGraph.edges) {
          enrichedGraph.edges = enrichedGraph.edges.map((e: any) => ({
            ...e,
            source: blockIdMap[e.source ?? e.from] ?? e.source ?? e.from,
            target: blockIdMap[e.target ?? e.to] ?? e.target ?? e.to,
          }))
        }

        const result = {
          ...plan,
          title: plan.documentation?.title ?? plan.title ?? 'Architecture Plan',
          summary: plan.documentation?.summary ?? plan.summary ?? '',
          markdown: plan.documentation?.markdown ?? plan.markdown ?? '',
          blocks: enrichedBlocks,
          graph: enrichedGraph,
          projectId,
        }

        planJobs.set(jobId, { status: 'done', result, createdAt: Date.now() })
        console.log(`[plan:${jobId}] ✅ Job complete`)

      } catch (err: any) {
        console.error(`[plan:${jobId}] Background error:`, err.message)
        planJobs.set(jobId, { status: 'error', error: err.message, createdAt: Date.now() })
      }
    })() // fire and forget

    // Respond immediately — frontend will poll /api/plan/status/:jobId
    return reply.send({ jobId, status: 'processing' })
  } // end of generateHandler

  // ── Job status polling endpoint ──────────────────────────────────────────
  app.get('/status/:jobId', { preHandler: verifyClerk }, async (req: any, reply) => {
    const { jobId } = req.params
    const job = planJobs.get(jobId)
    if (!job) return reply.code(404).send({ error: 'Job not found or expired' })
    if (job.status === 'processing') return reply.send({ status: 'processing' })
    if (job.status === 'error') return reply.code(500).send({ status: 'error', error: job.error })
    // Done — return full result but do NOT delete immediately.
    // The 10-minute garbage collector will clean it up. This prevents state loss on UI refresh/double-fetch.
    return reply.send({ status: 'done', result: job.result })
  })

  app.post('/', { preHandler: verifyClerk }, generateHandler)
  app.post('/generate', { preHandler: verifyClerk }, generateHandler)
}
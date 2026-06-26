import { Worker, Job } from 'bullmq'
import prisma from '../lib/prisma'
import { broadcastToProject } from '../ws/wsManager'

const connection = {
  url: process.env.REDIS_URL!,
  maxRetriesPerRequest: null,
  tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
  family: 0,
}

export function startBlockWorker() {
  const worker = new Worker(
    'generation-jobs',
    async (job: Job) => {

      if (job.name === 'merge') {
        console.log(`[worker] Skipping merge job ${job.id}`)
        return
      }

      console.log(`[worker] Processing job ${job.id} for block ${job.data.blockId}`)

      const { blockId, projectId, blockType, blockJson, prompt, runId, sharedContext, cascadeRegen, depBlockIds } = job.data

      // ── Orchestrate job ──────────────────────────────────────────────────
      if (job.name === 'orchestrate') {
        console.log(`[worker] Running orchestrator for run ${runId}`)
        try {
          const res = await fetch(`${process.env.AGENT_SERVICE_URL}/api/v1/orchestrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, prompt, runId }),
          })
          if (!res.ok) throw new Error(`Agent service failed: ${res.statusText}`)
          const result = await res.json()
          broadcastToProject(projectId, { event: 'workflow:completed', runId, result })
          return
        } catch (err: any) {
          console.error('[worker] Orchestration failed:', err)
          broadcastToProject(projectId, { event: 'workflow:failed', runId, error: err.message })
          throw err
        }
      }

      // ── Notify frontend: block starting ─────────────────────────────────
      broadcastToProject(projectId, {
        event: 'block:status_update',
        blockId,
        status: 'running',
        output: null,
        runId,
      })

      try {
        // ── Call Python agents /generate ─────────────────────────────────
        console.log(`[worker] Calling agent service for block ${blockId}`)

        // Use the rich BlockDocument from the planner if available (keyed by block_type),
        // otherwise fall back to constructing a minimal one from the canvas blockJson.
        const blockPlans = (sharedContext as any)?.blockPlans ?? {}
        const plannedBlock = blockPlans[blockType] ?? null

        const blockPayload = plannedBlock
          ? { ...plannedBlock, block_id: blockId }
          : {
              block_id: blockId,
              block_name: (blockJson as any)?.name ?? (blockJson as any)?.title ?? blockType,
              block_type: blockType,
              purpose: (blockJson as any)?.purpose ?? (blockJson as any)?.description ?? '',
              internal_logic: (blockJson as any)?.internal_logic ?? [],
              code_generation_plan: (blockJson as any)?.code_generation_plan ?? { stack: 'Not specified', files: [] },
              dependencies: (blockJson as any)?.dependencies ?? [],
              inputs: (blockJson as any)?.inputs ?? [],
              outputs: (blockJson as any)?.outputs ?? [],
              api_spec: (blockJson as any)?.api_spec ?? null,
              preview_behavior: (blockJson as any)?.preview_behavior ?? null,
            }

        const agentRes = await fetch(`${process.env.AGENT_SERVICE_URL}/api/v1/generate/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            executionId: runId,
            project_prompt: prompt,
            block: blockPayload,
            // ── Cross-block context for cascade regens ───────────────────
            // When this is a cascade-requeued job, inject the freshly-generated
            // output of every dependency block so the agent can produce coherent,
            // dependency-aware code without having to guess the upstream API surface.
            cross_block_context: await buildCrossBlockContext(cascadeRegen, depBlockIds),
          }),
          signal: AbortSignal.timeout(300_000),
        })

        if (!agentRes.ok) {
          const errText = await agentRes.text()
          throw new Error(`Agent error: ${agentRes.status} — ${errText}`)
        }

        const agentData = await agentRes.json() as { output_code: string; tokens_used: number }
        const output = agentData.output_code
        const tokensUsed = agentData.tokens_used ?? 0

        console.log(`[worker] Agent returned output for block ${blockId}`)

        // ── Save to DB ───────────────────────────────────────────────────
        await prisma.blockOutput.create({
          data: {
            runId,
            blockId,
            blockType,
            outputCode: output,
            tokensUsed,
            status: 'done',
          },
        })

        console.log('✅ BlockOutput saved to DB')

        // ── Notify frontend: block done ──────────────────────────────────
        broadcastToProject(projectId, {
          event: 'block:status_update',
          blockId,
          status: 'done',
          output,
          runId,
        })

        // ── Check if ALL blocks for this run are done ────────────────────
        await checkAndFinalizeRun(runId, projectId)

      } catch (error: any) {
        console.error('❌ Worker error:', error)

        await prisma.blockOutput.create({
          data: {
            runId,
            blockId,
            blockType,
            outputCode: '',
            status: 'failed',
            errorMsg: error.message,
          },
        })

        broadcastToProject(projectId, {
          event: 'block:status_update',
          blockId,
          status: 'failed',
          output: null,
          error: error.message,
          runId,
        })

        await checkAndFinalizeRun(runId, projectId)
      }
    },
    {
      connection,
      drainDelay: 60000,      // poll for new jobs every 60s instead of 5s
      stalledInterval: 300000, // stale-job check every 5 min instead of 30s
      lockDuration: 300000,    // extend lock to 5 min to match stall interval
    }
  )

  worker.on('completed', (job: Job) => console.log(`[worker] Job ${job.id} completed`))
  worker.on('failed', (job: Job | undefined, err: Error) => console.error(`[worker] Job ${job?.id} failed:`, err.message))

  console.log('[worker] Block generation worker started')
  return worker
}

// ── Helper: finalize run when all blocks are done/failed ─────────────────────
async function checkAndFinalizeRun(runId: string, projectId: string) {
  try {
    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: { blockOutputs: { select: { status: true } } }
    })

    if (!run) return

    const allFinished = run.blockOutputs.every(
      b => b.status === 'done' || b.status === 'failed'
    )

    if (allFinished && run.blockOutputs.length > 0) {
      const anyFailed = run.blockOutputs.some(b => b.status === 'failed')
      const finalStatus = anyFailed ? 'failed' : 'done'

      await prisma.workflowRun.update({
        where: { id: runId },
        data: { status: finalStatus as any }
      })

      broadcastToProject(projectId, {
        event: anyFailed ? 'workflow:failed' : 'workflow:completed',
        runId,
        status: finalStatus,
      })

      console.log(`✅ Run ${runId} finalized as ${finalStatus}`)
    }
  } catch (err) {
    console.error('[worker] Failed to finalize run:', err)
  }
}

// ── Helper: build cross-block context for cascade-requeued jobs ───────────────
//
// For each dependency block ID, fetches the latest "done" BlockOutput so the
// agent has the actual generated code from upstream blocks. Returns null for
// normal (non-cascade) jobs so there is no overhead on the regular path.

async function buildCrossBlockContext(
  cascadeRegen: boolean | undefined,
  depBlockIds: string[] | undefined,
): Promise<Record<string, string> | null> {
  if (!cascadeRegen || !depBlockIds || depBlockIds.length === 0) {
    return null
  }

  try {
    const outputs = await prisma.blockOutput.findMany({
      where: {
        blockId: { in: depBlockIds },
        status: 'done',
      },
      orderBy: { createdAt: 'desc' },
      select: { blockId: true, outputCode: true },
    })

    // Keep only the most recent done output per block (findMany is already ordered desc)
    const seen = new Set<string>()
    const contextMap: Record<string, string> = {}
    for (const o of outputs) {
      if (!seen.has(o.blockId)) {
        seen.add(o.blockId)
        contextMap[o.blockId] = o.outputCode
      }
    }

    console.log(
      `[worker] Built cross-block context from ${Object.keys(contextMap).length}/${depBlockIds.length} dep blocks`,
    )
    return contextMap
  } catch (err) {
    console.error('[worker] Failed to build cross-block context:', err)
    return null
  }
}
import type { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma'
import { verifyClerk } from '../middleware/clerkAuth'
import { getOrCreateUser } from '../lib/getOrCreateUser'
import { blockGenerationQueue } from '../queue/blockQueue'

export async function mergeRoutes(app: FastifyInstance) {

  app.post('/:id/merge', { preHandler: verifyClerk }, async (req: any, reply) => {

    const clerkId = req.user.sub
    await getOrCreateUser(clerkId)

    const { id: projectId } = req.params

    // Check project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })
    if (!project) {
      return reply.code(404).send({ error: 'Project not found' })
    }

    // Get the latest workflow run for this project
    const latestRun = await prisma.workflowRun.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { blockOutputs: true },
    })

    if (!latestRun) {
      return reply.code(400).send({ error: 'No workflow run found for this project' })
    }

    // Check all blocks are done
    const allDone = latestRun.blockOutputs.every(o => o.status === 'done')
    if (!allDone) {
      return reply.code(400).send({ 
        error: 'Not all blocks are done yet',
        statuses: latestRun.blockOutputs.map(o => ({ blockId: o.blockId, status: o.status }))
      })
    }

    // Enqueue merge job for Vedant's agent
    const job = await blockGenerationQueue.add('merge', {
      projectId,
      runId: latestRun.id,
      blockOutputs: latestRun.blockOutputs.map(o => ({
        blockId: o.blockId,
        blockType: o.blockType,
        outputCode: o.outputCode,
      })),
    })

    console.log(`[merge] Enqueued merge job ${job.id} for project ${projectId}, runId: ${latestRun.id}`)

    return reply.code(202).send({
      message: 'Merge job enqueued',
      projectId,
      runId: latestRun.id,
      jobId: job.id,
    })
  })
}
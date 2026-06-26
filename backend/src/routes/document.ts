import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { verifyClerk } from '../middleware/clerkAuth'
import { getOrCreateUser } from '../lib/getOrCreateUser'
import { buildMemoryContext } from '../memory/memoryRetriever'

const AGENT_URL = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8000'

export async function documentRoutes(app: FastifyInstance) {

  /** POST /api/projects/:id/document — generate document via AI agent */
  app.post('/:id/document', { preHandler: verifyClerk }, async (req: any, reply) => {
    const clerkId = req.user.sub
    await getOrCreateUser(clerkId)

    const { id: projectId } = req.params

    const parsed = z.object({ prompt: z.string().min(1) }).safeParse(req.body)
    if (!parsed.success) return reply.code(422).send({ error: parsed.error.flatten() })

    const { prompt } = parsed.data

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return reply.code(404).send({ error: 'Project not found' })

    // Get memory context for richer document
    const memoryContext = await buildMemoryContext(projectId)

    // Call AI agent to generate markdown document
    let markdownContent = ''
    try {
      const agentRes = await fetch(`${AGENT_URL}/api/v1/plan/doc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          project_name: project.name,
          memory_context: memoryContext,
        }),
        signal: AbortSignal.timeout(60_000),
      })

      if (!agentRes.ok) {
        const err = await agentRes.text()
        return reply.code(agentRes.status).send({ error: 'Agent failed to generate document', details: err })
      }

      const result = await agentRes.json() as { markdown: string }
      markdownContent = result.markdown

    } catch (err: any) {
      // Fallback: generate a basic template document if agent is unavailable
      markdownContent = generateFallbackDocument(project.name, prompt, memoryContext)
      console.warn(`[document] Agent unavailable, using fallback template: ${err.message}`)
    }

    // Check if document already exists for this project
    const existing = await prisma.projectDocument.findUnique({ where: { projectId } })

    let document
    if (existing) {
      // Update existing — increment version
      document = await prisma.projectDocument.update({
        where: { projectId },
        data: {
          content: markdownContent,
          status: 'pending',
          version: { increment: 1 },
        },
      })
      console.log(`[document] Updated document v${document.version} for project ${projectId}`)
    } else {
      // Create new
      document = await prisma.projectDocument.create({
        data: { projectId, content: markdownContent, status: 'pending' },
      })
      console.log(`[document] Created document for project ${projectId}`)
    }

    return reply.code(201).send({
      message: 'Document generated successfully',
      document,
    })
  })

  /** GET /api/projects/:id/document — get current document */
  app.get('/:id/document', { preHandler: verifyClerk }, async (req: any, reply) => {
    await getOrCreateUser(req.user.sub)
    const { id: projectId } = req.params

    const document = await prisma.projectDocument.findUnique({ where: { projectId } })
    if (!document) return reply.code(404).send({ error: 'No document found for this project' })

    return document
  })

  /** POST /api/projects/:id/document/approve — approve document */
  app.post('/:id/document/approve', { preHandler: verifyClerk }, async (req: any, reply) => {
    await getOrCreateUser(req.user.sub)
    const { id: projectId } = req.params

    const document = await prisma.projectDocument.findUnique({ where: { projectId } })
    if (!document) return reply.code(404).send({ error: 'No document found for this project' })
    if (document.status === 'approved') return reply.code(400).send({ error: 'Document already approved' })

    const updated = await prisma.projectDocument.update({
      where: { projectId },
      data: { status: 'approved' },
    })

    console.log(`[document] Approved for project ${projectId}`)
    return { message: 'Document approved — code generation unlocked', document: updated }
  })

  /** POST /api/projects/:id/document/reject — reject and request regeneration */
  app.post('/:id/document/reject', { preHandler: verifyClerk }, async (req: any, reply) => {
    await getOrCreateUser(req.user.sub)
    const { id: projectId } = req.params

    const document = await prisma.projectDocument.findUnique({ where: { projectId } })
    if (!document) return reply.code(404).send({ error: 'No document found for this project' })

    const updated = await prisma.projectDocument.update({
      where: { projectId },
      data: { status: 'rejected' },
    })

    return { message: 'Document rejected — please regenerate with a new prompt', document: updated }
  })
}

// ── Fallback template when agent is unavailable ────────────────────────────────
function generateFallbackDocument(
  projectName: string,
  prompt: string,
  memoryContext: Record<string, unknown>
): string {
  const techStack = Object.entries(memoryContext)
    .map(([k, v]) => `- **${k}**: ${v}`)
    .join('\n') || '- Not yet defined'

  return `# ${projectName} — Architecture Document

## Project Overview
${prompt}

## Tech Stack
${techStack}

## Blocks to Generate
- Frontend Block
- Backend Block
- Database Block

## Next Steps
1. Review this document
2. Approve to start code generation
3. Monitor real-time progress via WebSocket

---
*Generated by CraftaStudio — pending AI agent availability*
`
}
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import prisma from "../lib/prisma";
import { verifyClerk } from "../middleware/clerkAuth";
import { getOrCreateUser } from "../lib/getOrCreateUser";
import { askLLM } from "../lib/llm";

const CreateProjectSchema = z.object({
  name: z.string().min(1),
  teamId: z.string().uuid(),
});

export async function projectsRoutes(app: FastifyInstance) {

  /** GET /api/projects?teamId=xxx */
  app.get("/", { preHandler: verifyClerk }, async (req: any, reply) => {
    const clerkId = req.user.sub;
    await getOrCreateUser(clerkId);

    const { teamId } = req.query as { teamId?: string };
    if (!teamId) return reply.code(400).send({ error: "teamId is required" });

    const projects = await prisma.project.findMany({
      where: { teamId },
      orderBy: { createdAt: "asc" },
    });
    return projects;
  });

  /** GET /api/projects/:id */
  app.get("/:id", { preHandler: verifyClerk }, async (req: any, reply) => {
    const { id } = req.params as { id: string };
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return reply.code(404).send({ error: "Project not found" });
    return project;
  });

  /** POST /api/projects */
  app.post("/", { preHandler: verifyClerk }, async (req: any, reply) => {
    const parsed = CreateProjectSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(422).send({ error: parsed.error.flatten() });

    const clerkId = req.user.sub;
    const user = await getOrCreateUser(clerkId); // already imported

    const project = await prisma.project.create({
      data: {
        name: parsed.data.name,
        teamId: parsed.data.teamId,
        createdByUserId: user.id, // 👈 add this
      },
    });
    return reply.code(201).send(project);
  });

  /** DELETE /api/projects/:id */
  app.delete("/:id", { preHandler: verifyClerk }, async (req: any, reply) => {
    const { id } = req.params as { id: string };
    await prisma.project.delete({ where: { id } });
    return reply.code(204).send();
  });

  /** PATCH /api/projects/:id — rename a project or update planDoc */
  app.patch("/:id", { preHandler: verifyClerk }, async (req: any, reply) => {
    const { id } = req.params as { id: string };
    const parsed = z.object({ name: z.string().min(1).optional(), planDoc: z.string().optional() }).safeParse(req.body);
    if (!parsed.success) return reply.code(422).send({ error: parsed.error.flatten() });
    const updateData: Record<string, string> = {};
    if (parsed.data.name) updateData.name = parsed.data.name;
    if (parsed.data.planDoc !== undefined) updateData.planDoc = parsed.data.planDoc;
    if (Object.keys(updateData).length === 0) return reply.code(422).send({ error: "Nothing to update" });
    const project = await prisma.project.update({
      where: { id },
      data: updateData,
    });
    // Unify save by updating both tables simultaneously
    if (parsed.data.planDoc !== undefined) {
      await prisma.projectDocument.upsert({
        where: { projectId: id },
        update: { content: parsed.data.planDoc },
        create: { projectId: id, content: parsed.data.planDoc, status: 'approved' }
      }).catch((err: any) => console.warn('[projects PATCH] Failed to sync ProjectDocument:', err.message));
    }
    return project;
  });

  /** GET /api/projects/:id/plan */
  /** GET /api/projects/:id/plan — get saved plan document */
  app.get('/:id/plan', { preHandler: verifyClerk }, async (req: any, reply) => {
    await getOrCreateUser(req.user.sub)
    const { id: projectId } = req.params
    const doc = await prisma.projectDocument.findUnique({ where: { projectId } })
    if (!doc) return reply.code(404).send({ error: 'No plan found' })
    try {
      return reply.send(JSON.parse(doc.content))
    } catch {
      return reply.send({ content: doc.content })
    }
  })
  /** PUT /api/projects/:id/plan */
  app.put("/:id/plan", { preHandler: verifyClerk }, async (req: any, reply) => {
    const { id } = req.params as { id: string };
    const { content } = req.body as { content: string };

    // Upsert the ProjectDocument record with the plan content
    const doc = await prisma.projectDocument.upsert({
      where: { projectId: id },
      update: { content },
      create: { projectId: id, content, status: 'pending' },
    });
    // Unify save by updating both tables simultaneously
    await prisma.project.update({
      where: { id },
      data: { planDoc: content }
    }).catch((err: any) => console.warn('[projects PUT] Failed to sync Project.planDoc:', err.message));
    return { planDoc: doc.content };
  });

  /** GET /api/projects/:id/plan/validate */
  app.get("/:id/plan/validate", { preHandler: verifyClerk }, async (req: any, reply) => {
    const { id } = req.params as { id: string };
    const project = await prisma.project.findUnique({
      where: { id },
      include: { document: true }
    });
    if (!project) return reply.code(404).send({ error: "Project not found" });

    const doc = project.document?.content || "";
    const missing: string[] = [];

    if (!doc.includes("## Overview")) missing.push("Overview");
    if (!doc.includes("## Architecture")) missing.push("Architecture");
    if (!doc.includes("## Blocks") && !doc.includes("| Block ID |")) missing.push("Blocks Table");
    if (!doc.includes("## Pages")) missing.push("Pages");
    if (!doc.includes("## Data Models")) missing.push("Data Models");
    if (!doc.includes("## API Endpoints")) missing.push("API Endpoints");
    if (!doc.includes("## Build Order")) missing.push("Build Order");

    if (missing.length > 0) {
      return reply.code(400).send({ valid: false, missing });
    }

    return { valid: true, missing: [] };
  });

  /**
   * POST /api/projects/:id/chat
   * Global project-level AI chat with context of all blocks + planDoc.
   * Ephemeral — responses are not persisted (stateless for simplicity).
   */
  app.post('/:id/chat', { preHandler: verifyClerk }, async (req: any, reply) => {
    await getOrCreateUser(req.user.sub)
    const { id: projectId } = req.params as { id: string }

    const { message, chatHistory = [] } = req.body as {
      message: string
      chatHistory: { role: string; content: string }[]
    }
    if (!message?.trim()) return reply.code(400).send({ error: 'message is required' })

    // Load project + all blocks for full context
    const [project, blocks] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId }, select: { name: true, planDoc: true } }),
      prisma.block.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }),
    ])
    if (!project) return reply.code(404).send({ error: 'Project not found' })

    // Build a compact block summary for the system prompt
    const blockSummary = blocks
      .map((b) => {
        const bj = b.blockJson as Record<string, any>
        return `• [${b.blockType.toUpperCase()}] ${bj.title ?? b.blockType}: ${bj.description ?? ''} (stack: ${bj.stack ?? 'N/A'})`
      })
      .join('\n')

    const systemPrompt = `You are a senior software architect AI assistant embedded in CraftaStudio.
You are helping the user understand and improve the architecture of their project: "${project.name}".

Architecture blocks (${blocks.length} total):
${blockSummary || 'No blocks generated yet.'}

Project plan summary:
${project.planDoc ? project.planDoc.slice(0, 3000) : 'Not available.'}

Your role:
- Answer questions about how blocks connect and depend on each other
- Suggest improvements, patterns, or alternative approaches
- Explain the data flow and deployment order
- Help the user understand trade-offs in their tech choices
- Be concise and direct — the user is technical

Respond in plain Markdown. Keep responses under 400 words unless a longer explanation is truly needed.`

    try {
      const recentHistory = chatHistory.slice(-20).map((m: any) => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content as string,
      }))
      const anthropicMessages = [...recentHistory, { role: 'user' as const, content: message }]

      const responseText = await askLLM(systemPrompt, anthropicMessages, {
        model: process.env.CLAUDE_PLAN_MODEL ?? 'claude-haiku-4-5-20251001',
        maxTokens: 1024,
      })

      return reply.send({ message: responseText })
    } catch (err: any) {
      console.error('[projects/chat] askLLM failed:', err.message)
      return reply.code(502).send({ error: 'AI request failed', message: err.message })
    }
  })
}
import prisma from '../lib/prisma'
import { MemoryType, Priority } from '@prisma/client'

const DEFAULT_CONFIDENCE_THRESHOLD = 0.4
const DEFAULT_TOP_N = 20

const PRIORITY_WEIGHT: Record<Priority, number> = {
  [Priority.high]: 3,
  [Priority.medium]: 2,
  [Priority.low]: 1,
}

// 'architecture_decision' is not a valid MemoryType — use MemoryType.architecture_decision
const RELEVANT_TYPES: MemoryType[] = [
  MemoryType.architecture_decision,
  MemoryType.preference,
  MemoryType.constraint,
  MemoryType.pattern,
]

export async function retrieveMemories(
  projectId: string,
  options: {
    confidenceThreshold?: number
    topN?: number
    types?: MemoryType[]
  } = {}
) {
  const {
    confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
    topN = DEFAULT_TOP_N,
    types = RELEVANT_TYPES,
  } = options

  const memories = await prisma.memory.findMany({
    where: {
      projectId,
      confidence: { gte: confidenceThreshold },
      type: { in: types },   // ← schema field is 'type'
    },
    orderBy: [
      { confidence: 'desc' },
      { updatedAt: 'desc' },
    ],
    take: topN * 2,
  })

  const sorted = memories.sort((a, b) => {
    const scoreA = (PRIORITY_WEIGHT[a.priority] ?? 1) * a.confidence
    const scoreB = (PRIORITY_WEIGHT[b.priority] ?? 1) * b.confidence
    return scoreB - scoreA
  })

  const seen = new Set<string>()
  const deduplicated = sorted.filter(m => {
    if (seen.has(m.key)) return false
    seen.add(m.key)
    return true
  })

  return deduplicated.slice(0, topN)
}

export async function buildMemoryContext(
  projectId: string
): Promise<Record<string, unknown>> {
  const memories = await retrieveMemories(projectId)

  if (memories.length === 0) {
    console.log(`[memory] No memories found for project ${projectId}`)
    return {}
  }

  const context: Record<string, unknown> = {}
  for (const memory of memories) {
    const value = (memory.value as any)?.data ?? memory.value
    context[memory.key] = value
  }

  await prisma.memory.updateMany({
    where: {
      projectId,
      key: { in: memories.map(m => m.key) },
    },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  })

  console.log(`[memory] Built context with ${memories.length} memories`)
  return context
}

export async function getProjectMemories(projectId: string) {
  return prisma.memory.findMany({
    where: { projectId },
    orderBy: [
      { priority: 'asc' },
      { confidence: 'desc' },
    ],
  })
}
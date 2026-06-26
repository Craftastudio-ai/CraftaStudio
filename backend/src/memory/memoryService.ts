import prisma from '../lib/prisma'
import { MemoryType, Priority, MemorySource } from '@prisma/client'
import { extractSignals, ExtractedSignal } from './memoryExtractor'

// ── Upsert single signal ───────────────────────────────────────────────────────
export async function upsertMemory(
  projectId: string,
  signal: ExtractedSignal,
): Promise<void> {
  const existing = await prisma.memory.findUnique({
    where: { projectId_key: { projectId, key: signal.key } },
  })

  if (!existing) {
    await prisma.memory.create({
      data: {
        projectId,
        key: signal.key,
        value: { data: signal.value } as any,
        type: signal.type,
        priority: signal.priority,
        source: signal.source,
        confidence: 0.6,
        version: 1,
      },
    })
    return
  }

  const existingValue = (existing.value as any)?.data
  const isSameValue =
    String(existingValue).toLowerCase() ===
    String(signal.value).toLowerCase()

  if (isSameValue) {
    await prisma.memory.update({
      where: { projectId_key: { projectId, key: signal.key } },
      data: {
        confidence: Math.min(existing.confidence + 0.1, 1.0),
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    })
  } else {
    await prisma.memory.update({
      where: { projectId_key: { projectId, key: signal.key } },
      data: {
        value: { data: signal.value } as any,
        type: signal.type,
        priority: signal.priority,
        source: signal.source,
        confidence: 0.6,
        version: { increment: 1 },
        isConflict: true,
        updatedAt: new Date(),
      },
    })
  }
}

// ── Process prompt ─────────────────────────────────────────────────────────────
export async function processAndStoreMemory(
  projectId: string,
  input: string,
  source: MemorySource = MemorySource.user,
): Promise<ExtractedSignal[]> {
  const signals = extractSignals(input, source)

  if (signals.length === 0) return []

  await Promise.all(signals.map(s => upsertMemory(projectId, s)))

  return signals
}

// ── Capture signals from generated code ────────────────────────────────────────
export async function captureOutputSignals(
  projectId: string,
  outputCode: string,
  blockType: string,
): Promise<void> {
  const inferredSignals: ExtractedSignal[] = []

  if (/prisma/i.test(outputCode)) {
    inferredSignals.push({
      key: 'orm',
      value: 'prisma',
      type: MemoryType.architecture_decision,
      priority: Priority.high,
      source: MemorySource.inferred,
    })
  }

  if (/fastify/i.test(outputCode)) {
    inferredSignals.push({
      key: 'framework',
      value: 'fastify',
      type: MemoryType.architecture_decision,
      priority: Priority.high,
      source: MemorySource.inferred,
    })
  }

  if (/tailwind/i.test(outputCode)) {
    inferredSignals.push({
      key: 'styling',
      value: 'tailwindcss',
      type: MemoryType.preference,
      priority: Priority.medium,
      source: MemorySource.inferred,
    })
  }

  if (/react|useState|useEffect/i.test(outputCode)) {
    inferredSignals.push({
      key: 'framework',
      value: 'react',
      type: MemoryType.architecture_decision,
      priority: Priority.high,
      source: MemorySource.inferred,
    })
  }

  // Lines 106, 112, 124 in the error — 'architecture_decision' and 'inferred'
  // don't exist in the schema enums. Map them to valid values:
  // 'architecture_decision' → MemoryType.architecture_decision
  // 'inferred' → MemorySource.inferred
  // 'medium' → Priority.medium
  if (/next\.?js|react|vue|svelte/i.test(outputCode)) {
    inferredSignals.push({
      key: 'frontend_framework',
      value: outputCode.match(/next\.?js|react|vue|svelte/i)?.[0]?.toLowerCase() ?? 'react',
      type: MemoryType.architecture_decision,
      priority: Priority.high,
      source: MemorySource.inferred,
    })
  }

  if (/postgresql|mongodb|mysql|sqlite/i.test(outputCode)) {
    inferredSignals.push({
      key: 'database',
      value: outputCode.match(/postgresql|mongodb|mysql|sqlite/i)?.[0]?.toLowerCase() ?? 'postgresql',
      type: MemoryType.architecture_decision,
      priority: Priority.medium,
      source: MemorySource.inferred,
    })
  }

  if (inferredSignals.length > 0) {
    await Promise.all(inferredSignals.map(s => upsertMemory(projectId, s)))
  }
}
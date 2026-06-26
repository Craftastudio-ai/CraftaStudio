/**
 * Project Service — business logic for project lifecycle.
 * Only uses fields that exist in the current Prisma schema.
 */
import prisma from '../lib/prisma'

// ── Update project planDoc after plan generation ────────────────
export async function updateProjectFromPlan(
  projectId: string,
  planDoc: string
) {
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { planDoc },
    })
    console.log(`[projectService] Updated planDoc for project ${projectId}`)
  } catch (err) {
    console.error(`[projectService] Failed to update project ${projectId}:`, err)
  }
}

// ── Resolve a block type string to a safe string ────────────────
const BLOCK_TYPE_MAP: Record<string, string> = {
  frontend: 'ui', ui: 'ui', client: 'ui', web: 'ui',
  backend: 'api', api: 'api', server: 'api', gateway: 'api',
  database: 'data', data: 'data', db: 'data', storage: 'data', postgres: 'data',
  auth: 'auth', authentication: 'auth',
  job: 'job', worker: 'job', task: 'job',
  integration: 'integration', external: 'integration',
  service: 'service',
}

export function resolveBlockType(raw: string): string {
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '')
  return BLOCK_TYPE_MAP[key] ?? 'service'
}

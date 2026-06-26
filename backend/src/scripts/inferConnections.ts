/**
 * scripts/inferConnections.ts
 *
 * One-time migration / dev utility to run the inference engine
 * over all projects (or a specific one) and create missing connections.
 *
 * Usage:
 *   # All projects
 *   ts-node src/scripts/inferConnections.ts
 *
 *   # Specific project
 *   ts-node src/scripts/inferConnections.ts --projectId=<uuid>
 *
 *   # Dry run (preview only, no DB writes)
 *   ts-node src/scripts/inferConnections.ts --dry-run
 *
 *   # Lower threshold (more aggressive)
 *   ts-node src/scripts/inferConnections.ts --threshold=0.5
 */

import prisma from '../lib/prisma'
import { inferConnections } from '../graph/connectionInference'

// ─── Parse CLI args ─────────────────────────────────────────────────────────

const args = process.argv.slice(2)

function getArg(name: string): string | undefined {
  const match = args.find(a => a.startsWith(`--${name}=`))
  return match?.split('=')[1]
}

const specificProjectId  = getArg('projectId')
const dryRun             = args.includes('--dry-run')
const threshold          = parseFloat(getArg('threshold') ?? '0.60')

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 Graphify Connection Inference`)
  console.log(`   Mode:      ${dryRun ? 'DRY RUN (no writes)' : 'WRITE'}`)
  console.log(`   Threshold: ${threshold}`)
  console.log(`   Target:    ${specificProjectId ?? 'all projects'}\n`)

  // Load target projects
  let projectIds: string[]

  if (specificProjectId) {
    projectIds = [specificProjectId]
  } else {
    const projects = await prisma.project.findMany({ select: { id: true } })
    projectIds = projects.map(p => p.id)
  }

  console.log(`📦 Processing ${projectIds.length} project(s)...\n`)

  let totalCreated = 0
  let totalSkipped = 0
  let totalCyclesPrevented = 0

  for (const projectId of projectIds) {
    try {
      // Get current edge count for display
      const existingCount = await prisma.connection.count({
        where: { projectId, deletedAt: null },
      })
      const blockCount = await prisma.block.count({
        where: { projectId, deletedAt: null },
      })

      process.stdout.write(`  project=${projectId.slice(0, 8)}... blocks=${blockCount} edges=${existingCount} → `)

      const result = await inferConnections(projectId, 'system:script', threshold, dryRun)

      const newEdges = await prisma.connection.count({
        where: { projectId, deletedAt: null },
      })

      console.log(
        dryRun
          ? `would create ${result.inferred.length} connections`
          : `created=${result.created} skipped=${result.skipped} cycles_prevented=${result.cyclesPrevented} edges_now=${newEdges}`
      )

      if (result.inferred.length > 0 && dryRun) {
        for (const c of result.inferred) {
          console.log(
            `    ${c.rule.padEnd(24)} ${c.fromBlockId.slice(0, 8)} → ${c.toBlockId.slice(0, 8)}` +
            `  confidence=${c.confidence.toFixed(2)}  type=${c.connectionType}`
          )
          console.log(`      reason: ${c.reason}`)
        }
      }

      totalCreated        += result.created
      totalSkipped        += result.skipped
      totalCyclesPrevented += result.cyclesPrevented

    } catch (err) {
      console.error(`  ❌ project=${projectId} FAILED:`, err)
    }
  }

  console.log(`\n✅ Done`)
  console.log(`   Total created:          ${totalCreated}`)
  console.log(`   Total skipped:          ${totalSkipped}`)
  console.log(`   Cycles prevented:       ${totalCyclesPrevented}`)

  if (dryRun) {
    console.log(`\n💡 Run without --dry-run to apply changes.`)
  }

  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
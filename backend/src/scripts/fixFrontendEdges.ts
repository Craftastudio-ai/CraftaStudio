/**
 * fixFrontendEdges.ts
 *
 * Deletes the 4 bad "frontend → api/backend/ui" edges that were created
 * before frontend was added to TYPE_HIERARCHY, then re-runs inference
 * to create the correct "api/backend → frontend" edges in their place.
 */

import { PrismaClient } from '@prisma/client'
import { inferConnections } from '../graph/connectionInference'

const prisma = new PrismaClient()

// Bad connection IDs confirmed from inspectConnections.ts output
const BAD_CONNECTION_IDS = [
  '39cecc2d-ce1e-4cde-b3e3-REPLACEME',  // 5b87b476: frontend → backend
  '71ffd4a8-REPLACEME',                  // 5b87b476: frontend → ui
  '76363f5f-REPLACEME',                  // 66b554b2: frontend → api
  'b2838857-REPLACEME',                  // 72bff919: frontend → api
]

const AFFECTED_PROJECTS = [
  '5b87b476-0bd3-4e8f-9233-74606bb6fbfb',
  '66b554b2-55ec-4b6c-a012-b072ebca160d',
  '72bff919-d81a-48da-9fde-275268253f18',
]

async function main() {
  console.log('🔧 Fixing bad frontend edges...\n')

  // 1. Fetch full IDs for the bad connections using short ID prefix match
  const shortIds = ['39cecc2d', '71ffd4a8', '76363f5f', 'b2838857']

  const badConns = await prisma.connection.findMany({
    where: {
      projectId: { in: AFFECTED_PROJECTS },
    },
    select: { id: true, fromBlockId: true, toBlockId: true, projectId: true },
  })

  const toDelete = badConns.filter(c => shortIds.includes(c.id.slice(0, 8)))

  if (toDelete.length === 0) {
    console.log('⚠️  No matching bad connections found — they may already be deleted.')
  } else {
    console.log(`🗑️  Deleting ${toDelete.length} bad edges:`)
    for (const c of toDelete) {
      console.log(`   ${c.id.slice(0, 8)}: ${c.fromBlockId.slice(0, 8)} → ${c.toBlockId.slice(0, 8)}`)
      await prisma.connection.delete({ where: { id: c.id } })
    }
  }

  // 2. Re-run inference on affected projects to create correct edges
  console.log('\n🔁 Re-running inference on affected projects...')
  for (const projectId of AFFECTED_PROJECTS) {
    const result = await inferConnections(projectId, undefined, 0.60, false)
    console.log(`   project=${projectId.slice(0, 8)} created=${result.created} cyclesPrevented=${result.cyclesPrevented}`)
  }

  console.log('\n✅ Done')
  await prisma.$disconnect()
}

main().catch(console.error)
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const projects = [
  '5b87b476-0bd3-4e8f-9233-74606bb6fbfb',
  '66b554b2-55ec-4b6c-a012-b072ebca160d',
  '72bff919-d81a-48da-9fde-275268253f18',
]

async function main() {
  for (const projectId of projects) {
    console.log('\n📦 Project:', projectId)

    const blocks = await prisma.block.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, blockType: true, blockJson: true },
    })

    const blockMap = new Map(blocks.map(b => [
      b.id,
      `${b.blockType}(${((b.blockJson as any)?.title || b.id).slice(0, 15)})`,
    ]))

    const conns = await prisma.connection.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, fromBlockId: true, toBlockId: true, connectionType: true },
    })

    console.log(`   ${blocks.length} blocks, ${conns.length} connections:`)
    for (const c of conns) {
      const from = blockMap.get(c.fromBlockId) ?? c.fromBlockId.slice(0, 8)
      const to   = blockMap.get(c.toBlockId)   ?? c.toBlockId.slice(0, 8)
      console.log(`   ${from}  →  ${to}  [${c.connectionType}]  id=${c.id.slice(0, 8)}`)
    }
  }

  await prisma.$disconnect()
}

main().catch(console.error)
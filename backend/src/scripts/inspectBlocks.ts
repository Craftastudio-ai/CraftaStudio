/**
 * Quick diagnostic — prints actual blockType and blockJson for your blocks
 */
import prisma from '../lib/prisma'

async function main() {
  const projects = await prisma.project.findMany({
    where: { blocks: { some: { deletedAt: null } } },
    select: { id: true, name: true },
    take: 3,
  })

  for (const project of projects) {
    console.log(`\n📦 Project: ${project.name} (${project.id})`)

    const blocks = await prisma.block.findMany({
      where: { projectId: project.id, deletedAt: null },
      select: { id: true, blockType: true, blockJson: true, name: true },
    })

    for (const b of blocks) {
      console.log(`  id:        ${b.id}`)
      console.log(`  blockType: ${b.blockType}`)
      console.log(`  name:      ${b.name ?? '(null)'}`)
      console.log(`  blockJson: ${JSON.stringify(b.blockJson)}`)
      console.log('  ---')
    }
  }

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
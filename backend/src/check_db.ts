import prisma from "./lib/prisma";

async function main() {
  console.log("Checking DB status...");
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          blocks: true,
        }
      }
    }
  });
  console.log("Projects in database:");
  console.log(JSON.stringify(projects, null, 2));
}

main().catch(console.error);

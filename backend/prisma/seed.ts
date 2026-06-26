import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.create({
    data: {
      name: "My Project",
      team: {
        create: {
          name: "My Team",
          user: {
            create: {
              clerkId: "test_clerk_id_123",
              email: "test@example.com",
              name: "Sanika",
            },
          },
        },
      },
    },
    include: {
      team: true,
    },
  });

  console.log(project);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
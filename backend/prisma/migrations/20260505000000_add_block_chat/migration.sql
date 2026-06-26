-- CreateTable
CREATE TABLE "block_chats" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "block_chats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "block_chats_blockId_createdAt_idx" ON "block_chats"("blockId", "createdAt");

-- CreateIndex
CREATE INDEX "block_chats_projectId_idx" ON "block_chats"("projectId");

-- AddForeignKey
ALTER TABLE "block_chats" ADD CONSTRAINT "block_chats_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_chats" ADD CONSTRAINT "block_chats_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

/*
  Warnings:

  - The `connectionType` column on the `connections` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[projectId,blockType]` on the table `blocks` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ConflictSeverity" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('frontend', 'backend', 'planner', 'merge');

-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('architecture_decision', 'preference', 'constraint', 'event', 'pattern');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "MemorySource" AS ENUM ('user', 'system', 'inferred');

-- CreateEnum
CREATE TYPE "ConflictType" AS ENUM ('syntax', 'dependency', 'logic');

-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('dependency', 'data_flow', 'trigger');

-- DropForeignKey
ALTER TABLE "teams" DROP CONSTRAINT "teams_userId_fkey";

-- AlterTable
ALTER TABLE "blocks" ADD COLUMN     "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "uiMeta" JSONB;

-- AlterTable
ALTER TABLE "connections" ADD COLUMN     "sourceHandle" TEXT,
ADD COLUMN     "targetHandle" TEXT,
DROP COLUMN "connectionType",
ADD COLUMN     "connectionType" "ConnectionType" NOT NULL DEFAULT 'dependency';

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "blockId" TEXT,
    "jobType" "JobType" NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'pending',
    "logs" JSONB,
    "errorMsg" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merged_outputs" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "finalCode" TEXT NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merged_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conflict_logs" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "blockId" TEXT,
    "conflictType" "ConflictType" NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "ConflictSeverity" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conflict_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_metadata" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileUrl" TEXT,
    "storageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "MemoryType" NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "source" "MemorySource",
    "isConflict" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "job_runs_workflowRunId_idx" ON "job_runs"("workflowRunId");

-- CreateIndex
CREATE INDEX "job_runs_blockId_idx" ON "job_runs"("blockId");

-- CreateIndex
CREATE INDEX "job_runs_createdAt_idx" ON "job_runs"("createdAt");

-- CreateIndex
CREATE INDEX "job_runs_status_idx" ON "job_runs"("status");

-- CreateIndex
CREATE INDEX "job_runs_jobType_idx" ON "job_runs"("jobType");

-- CreateIndex
CREATE INDEX "merged_outputs_workflowRunId_idx" ON "merged_outputs"("workflowRunId");

-- CreateIndex
CREATE INDEX "merged_outputs_createdAt_idx" ON "merged_outputs"("createdAt");

-- CreateIndex
CREATE INDEX "conflict_logs_workflowRunId_idx" ON "conflict_logs"("workflowRunId");

-- CreateIndex
CREATE INDEX "conflict_logs_blockId_idx" ON "conflict_logs"("blockId");

-- CreateIndex
CREATE INDEX "conflict_logs_createdAt_idx" ON "conflict_logs"("createdAt");

-- CreateIndex
CREATE INDEX "file_metadata_workflowRunId_idx" ON "file_metadata"("workflowRunId");

-- CreateIndex
CREATE INDEX "file_metadata_createdAt_idx" ON "file_metadata"("createdAt");

-- CreateIndex
CREATE INDEX "memories_projectId_type_confidence_idx" ON "memories"("projectId", "type", "confidence");

-- CreateIndex
CREATE INDEX "memories_projectId_idx" ON "memories"("projectId");

-- CreateIndex
CREATE INDEX "memories_type_idx" ON "memories"("type");

-- CreateIndex
CREATE INDEX "memories_key_idx" ON "memories"("key");

-- CreateIndex
CREATE INDEX "memories_projectId_type_idx" ON "memories"("projectId", "type");

-- CreateIndex
CREATE INDEX "memories_confidence_idx" ON "memories"("confidence");

-- CreateIndex
CREATE INDEX "memories_projectId_key_version_idx" ON "memories"("projectId", "key", "version");

-- CreateIndex
CREATE INDEX "memories_updatedAt_idx" ON "memories"("updatedAt");

-- CreateIndex
CREATE INDEX "memories_priority_idx" ON "memories"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "memories_projectId_key_key" ON "memories"("projectId", "key");

-- CreateIndex
CREATE INDEX "WorkflowRun_createdAt_idx" ON "WorkflowRun"("createdAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_status_idx" ON "WorkflowRun"("status");

-- CreateIndex
CREATE INDEX "block_outputs_createdAt_idx" ON "block_outputs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_projectId_blockType_key" ON "blocks"("projectId", "blockType");

-- CreateIndex
CREATE INDEX "connections_connectionType_idx" ON "connections"("connectionType");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merged_outputs" ADD CONSTRAINT "merged_outputs_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_logs" ADD CONSTRAINT "conflict_logs_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_logs" ADD CONSTRAINT "conflict_logs_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_metadata" ADD CONSTRAINT "file_metadata_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

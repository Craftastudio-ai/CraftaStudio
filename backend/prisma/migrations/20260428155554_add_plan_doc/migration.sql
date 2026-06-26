/*
  Warnings:

  - You are about to drop the column `userId` on the `teams` table. All the data in the column will be lost.
  - You are about to drop the `WorkflowRun` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('owner', 'admin', 'member');

-- CreateEnum
CREATE TYPE "ReasoningMode" AS ENUM ('impact_analysis', 'root_cause_analysis', 'conflict_resolution', 'simulation', 'optimization');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('BLOCK_CREATED', 'BLOCK_UPDATED', 'BLOCK_DELETED', 'BLOCK_GENERATED', 'CONNECTION_CREATED', 'CONNECTION_DELETED', 'WORKFLOW_STARTED', 'WORKFLOW_COMPLETED', 'WORKFLOW_FAILED', 'CONFLICT_DETECTED', 'CONFLICT_RESOLVED', 'SNAPSHOT_CREATED', 'MEMORY_UPDATED');

-- CreateEnum
CREATE TYPE "ResolutionStrategy" AS ENUM ('accept_ai', 'accept_human', 'merge', 'escalate', 'defer');

-- CreateEnum
CREATE TYPE "ResolutionStatus" AS ENUM ('pending', 'resolved', 'escalated', 'deferred');

-- AlterEnum
ALTER TYPE "MemoryType" ADD VALUE 'rejection';

-- AlterEnum
ALTER TYPE "RunStatus" ADD VALUE 'awaiting_confirm';

-- DropForeignKey
ALTER TABLE "WorkflowRun" DROP CONSTRAINT "WorkflowRun_projectId_fkey";

-- DropForeignKey
ALTER TABLE "block_outputs" DROP CONSTRAINT "block_outputs_runId_fkey";

-- DropForeignKey
ALTER TABLE "conflict_logs" DROP CONSTRAINT "conflict_logs_workflowRunId_fkey";

-- DropForeignKey
ALTER TABLE "file_metadata" DROP CONSTRAINT "file_metadata_workflowRunId_fkey";

-- DropForeignKey
ALTER TABLE "job_runs" DROP CONSTRAINT "job_runs_workflowRunId_fkey";

-- DropForeignKey
ALTER TABLE "merged_outputs" DROP CONSTRAINT "merged_outputs_workflowRunId_fkey";

-- DropForeignKey
ALTER TABLE "teams" DROP CONSTRAINT "teams_userId_fkey";

-- DropIndex
DROP INDEX "blocks_projectId_blockType_key";

-- DropIndex
DROP INDEX "teams_userId_idx";

-- AlterTable
ALTER TABLE "block_outputs" ADD COLUMN     "r2Key" TEXT;

-- AlterTable
ALTER TABLE "blocks" ADD COLUMN     "affectedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "depthLevel" INTEGER,
ADD COLUMN     "generatedAt" TIMESTAMP(3),
ADD COLUMN     "name" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "subgraphJson" JSONB;

-- AlterTable
ALTER TABLE "conflict_logs" ADD COLUMN     "attributedUserId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "connections" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "file_metadata" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "depth" INTEGER;

-- AlterTable
ALTER TABLE "job_runs" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "triggeredByUserId" TEXT;

-- AlterTable
ALTER TABLE "memories" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "importanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "planDoc" TEXT,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "teams" DROP COLUMN "userId",
ADD COLUMN     "createdByUserId" TEXT;

-- DropTable
DROP TABLE "WorkflowRun";

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "triggeredByUserId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sharedContextJson" JSONB NOT NULL,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "agentVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_snapshots" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "graphJson" JSONB NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graph_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_summaries" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "summaryText" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reasoning_results" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "blockId" TEXT,
    "mode" "ReasoningMode" NOT NULL,
    "inputHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reasoning_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "triggeredBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conflict_resolutions" (
    "id" TEXT NOT NULL,
    "conflictLogId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "strategy" "ResolutionStrategy" NOT NULL,
    "status" "ResolutionStatus" NOT NULL DEFAULT 'pending',
    "aiConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conflict_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subgraph_cache" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "subgraphJson" JSONB NOT NULL,
    "depthLevel" INTEGER NOT NULL DEFAULT 0,
    "affectedIds" TEXT[],
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subgraph_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "block_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "blockType" TEXT NOT NULL,
    "description" TEXT,
    "defaultJson" JSONB NOT NULL,
    "validationSchema" JSONB,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "block_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_members_teamId_idx" ON "team_members"("teamId");

-- CreateIndex
CREATE INDEX "team_members_userId_idx" ON "team_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_teamId_userId_key" ON "team_members"("teamId", "userId");

-- CreateIndex
CREATE INDEX "workflow_runs_projectId_idx" ON "workflow_runs"("projectId");

-- CreateIndex
CREATE INDEX "workflow_runs_triggeredByUserId_idx" ON "workflow_runs"("triggeredByUserId");

-- CreateIndex
CREATE INDEX "workflow_runs_triggeredByUserId_projectId_idx" ON "workflow_runs"("triggeredByUserId", "projectId");

-- CreateIndex
CREATE INDEX "workflow_runs_createdAt_idx" ON "workflow_runs"("createdAt");

-- CreateIndex
CREATE INDEX "workflow_runs_status_idx" ON "workflow_runs"("status");

-- CreateIndex
CREATE INDEX "workflow_runs_triggeredByUserId_createdAt_idx" ON "workflow_runs"("triggeredByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "workflow_runs_projectId_triggeredByUserId_createdAt_idx" ON "workflow_runs"("projectId", "triggeredByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "graph_snapshots_projectId_idx" ON "graph_snapshots"("projectId");

-- CreateIndex
CREATE INDEX "graph_snapshots_projectId_version_idx" ON "graph_snapshots"("projectId", "version");

-- CreateIndex
CREATE INDEX "graph_snapshots_createdAt_idx" ON "graph_snapshots"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "graph_snapshots_projectId_version_key" ON "graph_snapshots"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "memory_summaries_projectId_key" ON "memory_summaries"("projectId");

-- CreateIndex
CREATE INDEX "memory_summaries_projectId_idx" ON "memory_summaries"("projectId");

-- CreateIndex
CREATE INDEX "reasoning_results_projectId_mode_idx" ON "reasoning_results"("projectId", "mode");

-- CreateIndex
CREATE INDEX "reasoning_results_inputHash_idx" ON "reasoning_results"("inputHash");

-- CreateIndex
CREATE INDEX "reasoning_results_expiresAt_idx" ON "reasoning_results"("expiresAt");

-- CreateIndex
CREATE INDEX "reasoning_results_projectId_blockId_idx" ON "reasoning_results"("projectId", "blockId");

-- CreateIndex
CREATE UNIQUE INDEX "reasoning_results_projectId_mode_inputHash_key" ON "reasoning_results"("projectId", "mode", "inputHash");

-- CreateIndex
CREATE INDEX "event_logs_projectId_eventType_idx" ON "event_logs"("projectId", "eventType");

-- CreateIndex
CREATE INDEX "event_logs_projectId_createdAt_idx" ON "event_logs"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "event_logs_createdAt_idx" ON "event_logs"("createdAt");

-- CreateIndex
CREATE INDEX "event_logs_eventType_idx" ON "event_logs"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "conflict_resolutions_conflictLogId_key" ON "conflict_resolutions"("conflictLogId");

-- CreateIndex
CREATE INDEX "conflict_resolutions_projectId_idx" ON "conflict_resolutions"("projectId");

-- CreateIndex
CREATE INDEX "conflict_resolutions_status_idx" ON "conflict_resolutions"("status");

-- CreateIndex
CREATE INDEX "conflict_resolutions_projectId_status_idx" ON "conflict_resolutions"("projectId", "status");

-- CreateIndex
CREATE INDEX "conflict_resolutions_createdAt_idx" ON "conflict_resolutions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "subgraph_cache_blockId_key" ON "subgraph_cache"("blockId");

-- CreateIndex
CREATE INDEX "subgraph_cache_projectId_idx" ON "subgraph_cache"("projectId");

-- CreateIndex
CREATE INDEX "subgraph_cache_blockId_idx" ON "subgraph_cache"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX "subgraph_cache_projectId_blockId_key" ON "subgraph_cache"("projectId", "blockId");

-- CreateIndex
CREATE UNIQUE INDEX "block_templates_name_key" ON "block_templates"("name");

-- CreateIndex
CREATE INDEX "block_templates_blockType_idx" ON "block_templates"("blockType");

-- CreateIndex
CREATE INDEX "block_outputs_blockId_status_createdAt_idx" ON "block_outputs"("blockId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "blocks_projectId_deletedAt_idx" ON "blocks"("projectId", "deletedAt");

-- CreateIndex
CREATE INDEX "blocks_projectId_version_idx" ON "blocks"("projectId", "version");

-- CreateIndex
CREATE INDEX "conflict_logs_attributedUserId_idx" ON "conflict_logs"("attributedUserId");

-- CreateIndex
CREATE INDEX "connections_projectId_deletedAt_idx" ON "connections"("projectId", "deletedAt");

-- CreateIndex
CREATE INDEX "connections_projectId_connectionType_idx" ON "connections"("projectId", "connectionType");

-- CreateIndex
CREATE INDEX "job_runs_triggeredByUserId_idx" ON "job_runs"("triggeredByUserId");

-- CreateIndex
CREATE INDEX "memories_projectId_type_priority_idx" ON "memories"("projectId", "type", "priority");

-- CreateIndex
CREATE INDEX "memories_projectId_priority_confidence_idx" ON "memories"("projectId", "priority", "confidence");

-- CreateIndex
CREATE INDEX "teams_createdByUserId_idx" ON "teams"("createdByUserId");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_outputs" ADD CONSTRAINT "block_outputs_runId_fkey" FOREIGN KEY ("runId") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merged_outputs" ADD CONSTRAINT "merged_outputs_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_logs" ADD CONSTRAINT "conflict_logs_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_logs" ADD CONSTRAINT "conflict_logs_attributedUserId_fkey" FOREIGN KEY ("attributedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_metadata" ADD CONSTRAINT "file_metadata_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_snapshots" ADD CONSTRAINT "graph_snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_summaries" ADD CONSTRAINT "memory_summaries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reasoning_results" ADD CONSTRAINT "reasoning_results_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reasoning_results" ADD CONSTRAINT "reasoning_results_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_resolutions" ADD CONSTRAINT "conflict_resolutions_conflictLogId_fkey" FOREIGN KEY ("conflictLogId") REFERENCES "conflict_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_resolutions" ADD CONSTRAINT "conflict_resolutions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_resolutions" ADD CONSTRAINT "conflict_resolutions_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subgraph_cache" ADD CONSTRAINT "subgraph_cache_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subgraph_cache" ADD CONSTRAINT "subgraph_cache_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

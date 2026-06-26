/*
  Warnings:

  - The `status` column on the `block_outputs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `workflow_runs` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `block_outputs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `connections` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `projects` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `teams` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `teams` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('pending', 'running', 'done', 'failed');

-- DropForeignKey
ALTER TABLE "block_outputs" DROP CONSTRAINT "block_outputs_runId_fkey";

-- DropForeignKey
ALTER TABLE "workflow_runs" DROP CONSTRAINT "workflow_runs_projectId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "block_outputs" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "RunStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "connections" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- DropTable
DROP TABLE "workflow_runs";

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sharedContextJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowRun_projectId_idx" ON "WorkflowRun"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "teams_userId_idx" ON "teams"("userId");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_outputs" ADD CONSTRAINT "block_outputs_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

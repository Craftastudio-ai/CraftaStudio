import { Queue } from 'bullmq'

const connection = {
  url: process.env.REDIS_URL!,
  maxRetriesPerRequest: null,
  tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
  family: 0,
}

export const blockGenerationQueue = new Queue('generation-jobs', {
  connection,
})

// Alias so workflow.ts can import without renaming
export const generationJobsQueue = blockGenerationQueue
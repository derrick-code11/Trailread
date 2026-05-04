import { Queue } from 'bullmq'
import { createRedisConnection } from './ioredis.js'

const QUEUE_NAME = 'ingestion'

let queueSingleton: Queue | null = null

export function getIngestionQueue(): Queue {
  if (!queueSingleton) {
    const connection = createRedisConnection()
    queueSingleton = new Queue(QUEUE_NAME, { connection })
  }
  return queueSingleton
}

export type IngestionJobPayload = {
  ingestionJobId: string
}

export async function enqueueIngestionJob(ingestionJobId: string): Promise<void> {
  const queue = getIngestionQueue()
  await queue.add(
    'run',
    { ingestionJobId } satisfies IngestionJobPayload,
    {
      jobId: ingestionJobId,
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
    },
  )
}

import { ArtifactType } from '@prisma/client'
import { Queue } from 'bullmq'
import { createRedisConnection } from './ioredis.js'

const QUEUE_NAME = 'chapter-artifacts'

let queueSingleton: Queue | null = null

export type ArtifactJobPayload = {
  chapterId: string
  type: ArtifactType
}

export function getArtifactQueue(): Queue {
  if (!queueSingleton) {
    const connection = createRedisConnection()
    queueSingleton = new Queue(QUEUE_NAME, { connection })
  }
  return queueSingleton
}

export async function enqueueArtifactJob(payload: ArtifactJobPayload): Promise<void> {
  const queue = getArtifactQueue()
  const jobId = `${payload.chapterId}__${payload.type}`
  await queue.add('generate', payload, {
    jobId,
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
  })
}

import "dotenv/config";
import { Worker } from "bullmq";
import { env } from "./config/env.js";
import { createRedisConnection } from "./queue/ioredis.js";
import type { ArtifactJobPayload } from "./queue/artifactQueue.js";
import type { IngestionJobPayload } from "./queue/ingestionQueue.js";
import { processQueuedArtifactJob } from "./workers/processArtifactJob.js";
import { processIngestionJob } from "./workers/processIngestionJob.js";

const INGESTION_QUEUE_NAME = "ingestion";
const ARTIFACT_QUEUE_NAME = "chapter-artifacts";

if (!env.REDIS_URL?.trim()) {
  console.error("[worker] REDIS_URL is required.");
  process.exit(1);
}

const connection = createRedisConnection();

const ingestionWorker = new Worker<IngestionJobPayload>(
  INGESTION_QUEUE_NAME,
  async (job) => {
    const { ingestionJobId } = job.data;
    await processIngestionJob(ingestionJobId);
  },
  { connection },
);

const artifactWorker = new Worker<ArtifactJobPayload>(
  ARTIFACT_QUEUE_NAME,
  async (job) => {
    const { chapterId, type } = job.data;
    await processQueuedArtifactJob(chapterId, type);
  },
  { connection },
);

ingestionWorker.on("completed", (job) => {
  console.log(`[worker] completed job ${job.id}`);
});

artifactWorker.on("completed", (job) => {
  console.log(`[worker] completed artifact job ${job.id}`);
});

ingestionWorker.on("failed", (job, err) => {
  console.error(`[worker] failed job ${job?.id}`, err);
});

artifactWorker.on("failed", (job, err) => {
  console.error(`[worker] failed artifact job ${job?.id}`, err);
});

console.log(
  `[worker] listening on queues "${INGESTION_QUEUE_NAME}" and "${ARTIFACT_QUEUE_NAME}" (NODE_ENV=${env.NODE_ENV})`,
);

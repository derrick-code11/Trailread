import "dotenv/config";
import { Worker } from "bullmq";
import { env } from "./config/env.js";
import { createRedisConnection } from "./queue/ioredis.js";
import type { IngestionJobPayload } from "./queue/ingestionQueue.js";
import { processIngestionJob } from "./workers/processIngestionJob.js";

const QUEUE_NAME = "ingestion";

if (!env.REDIS_URL?.trim()) {
  console.error("[worker] REDIS_URL is required.");
  process.exit(1);
}

const connection = createRedisConnection();

const worker = new Worker<IngestionJobPayload>(
  QUEUE_NAME,
  async (job) => {
    const { ingestionJobId } = job.data;
    await processIngestionJob(ingestionJobId);
  },
  { connection },
);

worker.on("completed", (job) => {
  console.log(`[worker] completed job ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] failed job ${job?.id}`, err);
});

console.log(
  `[worker] listening on queue "${QUEUE_NAME}" (NODE_ENV=${env.NODE_ENV})`,
);

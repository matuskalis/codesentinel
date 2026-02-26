import { Queue } from 'bullmq'
import IORedis from 'ioredis'

let redis: IORedis | null = null
let prScanQueue: Queue | null = null
let repoScanQueue: Queue | null = null

export function getRedis(): IORedis {
  if (!redis) {
    redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    })
  }
  return redis
}

export function getPRScanQueue(): Queue {
  if (!prScanQueue) {
    prScanQueue = new Queue('pr-scan', {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    })
  }
  return prScanQueue
}

export function getRepoScanQueue(): Queue {
  if (!repoScanQueue) {
    repoScanQueue = new Queue('repo-scan', {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    })
  }
  return repoScanQueue
}

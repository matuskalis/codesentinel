import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import pino from 'pino'
import { handlePRScan } from '../src/lib/jobs/handlers/pr-scan'
import { handleRepoScan } from '../src/lib/jobs/handlers/repo-scan'

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
})

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
})

logger.info({ redisUrl }, 'Worker starting...')

const prWorker = new Worker('pr-scan', handlePRScan, {
  connection,
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 60_000,
  },
})

prWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'pr-scan' }, 'Job completed')
})

prWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, queue: 'pr-scan', error: error.message }, 'Job failed')
})

prWorker.on('error', (error) => {
  logger.error({ queue: 'pr-scan', error: error.message }, 'Worker error')
})

const repoWorker = new Worker('repo-scan', handleRepoScan, {
  connection,
  concurrency: 3,
  limiter: {
    max: 5,
    duration: 60_000,
  },
})

repoWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, queue: 'repo-scan' }, 'Job completed')
})

repoWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, queue: 'repo-scan', error: error.message }, 'Job failed')
})

repoWorker.on('error', (error) => {
  logger.error({ queue: 'repo-scan', error: error.message }, 'Worker error')
})

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down workers...')

  await Promise.all([
    prWorker.close(),
    repoWorker.close(),
  ])

  await connection.quit()
  logger.info('Workers shut down gracefully')
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

logger.info('Workers started successfully')

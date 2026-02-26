import type { PRScanJobPayload, RepoScanJobPayload } from '@/types'
import { getPRScanQueue, getRepoScanQueue } from './queue'
import { logger } from '@/lib/logger'

export async function enqueuePRScan(payload: PRScanJobPayload): Promise<string> {
  const queue = getPRScanQueue()
  const jobId = `pr-${payload.repositoryId}-${payload.prNumber}-${payload.headSha}`

  const job = await queue.add('pr-scan', payload, { jobId })

  logger.info({
    jobId: job.id,
    repo: payload.repositoryFullName,
    pr: payload.prNumber,
    sha: payload.headSha,
  }, 'PR scan job enqueued')

  return job.id!
}

export async function enqueueRepoScan(payload: RepoScanJobPayload): Promise<string> {
  const queue = getRepoScanQueue()
  const jobId = `repo-${payload.repositoryId}-${payload.commitSha}`

  const job = await queue.add('repo-scan', payload, { jobId })

  logger.info({
    jobId: job.id,
    repo: payload.repositoryFullName,
    branch: payload.branch,
    sha: payload.commitSha,
  }, 'Repo scan job enqueued')

  return job.id!
}

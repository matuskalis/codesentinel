import { getInstallationOctokit } from './client'
import { logger } from '@/lib/logger'

export async function getPRDiff(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number
): Promise<string> {
  const octokit = await getInstallationOctokit(installationId)

  const response = await octokit.request(
    'GET /repos/{owner}/{repo}/pulls/{pull_number}',
    {
      owner,
      repo,
      pull_number: prNumber,
      mediaType: { format: 'diff' },
    }
  )

  return response.data as unknown as string
}

export async function getPRFiles(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number
): Promise<
  Array<{ filename: string; status: string; sha: string; patch?: string }>
> {
  const octokit = await getInstallationOctokit(installationId)

  const files: Array<{
    filename: string
    status: string
    sha: string
    patch?: string
  }> = []
  let page = 1

  while (true) {
    const response = await octokit.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
      {
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
        page,
      }
    )

    const data = response.data as Array<{
      filename: string
      status: string
      sha: string
      patch?: string
    }>
    files.push(...data)

    if (data.length < 100) break
    page++
  }

  return files
}

export async function getFileContent(
  installationId: number,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string> {
  const octokit = await getInstallationOctokit(installationId)

  try {
    const response = await octokit.request(
      'GET /repos/{owner}/{repo}/contents/{path}',
      {
        owner,
        repo,
        path,
        ref,
      }
    )

    const data = response.data as { content?: string; encoding?: string }
    if (data.content && data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8')
    }

    return ''
  } catch (error: unknown) {
    const statusError = error as { status?: number }
    if (statusError.status === 404) {
      logger.debug({ path, ref }, 'File not found')
      return ''
    }
    throw error
  }
}

export async function createPRComment(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number,
  body: string
): Promise<number> {
  const octokit = await getInstallationOctokit(installationId)

  const response = await octokit.request(
    'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
    {
      owner,
      repo,
      issue_number: prNumber,
      body,
    }
  )

  return (response.data as { id: number }).id
}

export async function updatePRComment(
  installationId: number,
  owner: string,
  repo: string,
  commentId: number,
  body: string
): Promise<void> {
  const octokit = await getInstallationOctokit(installationId)

  await octokit.request(
    'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}',
    {
      owner,
      repo,
      comment_id: commentId,
      body,
    }
  )
}

export async function createPRReview(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number,
  commitSha: string,
  comments: Array<{ path: string; position: number; body: string }>
): Promise<void> {
  const octokit = await getInstallationOctokit(installationId)

  await octokit.request(
    'POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
    {
      owner,
      repo,
      pull_number: prNumber,
      commit_id: commitSha,
      event: 'COMMENT' as const,
      comments,
    }
  )
}

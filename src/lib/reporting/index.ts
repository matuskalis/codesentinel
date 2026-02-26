import type { ReportInput } from '@/types'
import { formatSummaryComment } from './summary-comment'
import { formatInlineComments } from './inline-comments'
import { mapLineToPosition } from './diff-position'
import {
  createPRComment,
  updatePRComment,
  createPRReview,
} from '@/lib/github/api'
import {
  upsertScanComment,
  getScanCommentByPR,
} from '@/lib/db/queries/scan-comments'
import { logger } from '@/lib/logger'

interface PostResultsOptions {
  installationId: number
  owner: string
  repo: string
  pullRequestDbId: string
  filePatchMap: Map<string, string>
}

export async function postScanResults(
  input: ReportInput,
  options: PostResultsOptions
): Promise<number | undefined> {
  const { installationId, owner, repo, pullRequestDbId, filePatchMap } =
    options
  const scanLogger = logger.child({
    scanId: input.scanId,
    pr: input.prNumber,
  })

  // 1. Format and post/update summary comment
  const summaryBody = formatSummaryComment(input)
  let commentId: number

  const existingComment = await getScanCommentByPR(pullRequestDbId)

  if (existingComment) {
    await updatePRComment(
      installationId,
      owner,
      repo,
      existingComment.githubCommentId,
      summaryBody
    )
    commentId = existingComment.githubCommentId
    scanLogger.info({ commentId }, 'Updated existing summary comment')
  } else {
    commentId = await createPRComment(
      installationId,
      owner,
      repo,
      input.prNumber,
      summaryBody
    )
    scanLogger.info({ commentId }, 'Created new summary comment')
  }

  await upsertScanComment({
    scanId: input.scanId,
    pullRequestId: pullRequestDbId,
    githubCommentId: commentId,
    lastHeadSha: input.commitSha,
    lastScanId: input.scanId,
  })

  // 2. Post inline review comments (critical + high only)
  const inlineComments = formatInlineComments(input.result.findings)

  if (inlineComments.length > 0) {
    const reviewComments: Array<{
      path: string
      position: number
      body: string
    }> = []

    for (const comment of inlineComments) {
      const patch = filePatchMap.get(comment.path)
      if (!patch) {
        scanLogger.debug(
          { path: comment.path },
          'No patch for file, skipping inline comment'
        )
        continue
      }

      const position = mapLineToPosition(patch, comment.line)
      if (position === null) {
        scanLogger.debug(
          { path: comment.path, line: comment.line },
          'Could not map line to diff position, skipping'
        )
        continue
      }

      reviewComments.push({
        path: comment.path,
        position,
        body: comment.body,
      })
    }

    if (reviewComments.length > 0) {
      try {
        await createPRReview(
          installationId,
          owner,
          repo,
          input.prNumber,
          input.commitSha,
          reviewComments
        )
        scanLogger.info(
          { count: reviewComments.length },
          'Posted inline review comments'
        )
      } catch (error) {
        // Don't fail the scan if inline comments fail
        scanLogger.error({ error }, 'Failed to post inline review comments')
      }
    }
  }

  return commentId
}

import { eq } from 'drizzle-orm'
import { getDb } from '../index'
import { scanComments } from '../schema'

export async function upsertScanComment(data: {
  scanId: string
  pullRequestId: string
  githubCommentId: number
  lastHeadSha: string
  lastScanId: string
}) {
  const db = getDb()

  const [comment] = await db
    .insert(scanComments)
    .values({
      scanId: data.scanId,
      pullRequestId: data.pullRequestId,
      githubCommentId: data.githubCommentId,
      lastHeadSha: data.lastHeadSha,
      lastScanId: data.lastScanId,
    })
    .onConflictDoUpdate({
      target: scanComments.pullRequestId,
      set: {
        githubCommentId: data.githubCommentId,
        lastHeadSha: data.lastHeadSha,
        lastScanId: data.lastScanId,
        updatedAt: new Date(),
      },
    })
    .returning()

  return comment
}

export async function getScanCommentByPR(pullRequestId: string) {
  const db = getDb()

  const [comment] = await db
    .select()
    .from(scanComments)
    .where(eq(scanComments.pullRequestId, pullRequestId))
    .limit(1)

  return comment ?? null
}

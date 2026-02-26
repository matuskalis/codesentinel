import { and, eq } from 'drizzle-orm'
import { getDb } from '../index'
import { pullRequests } from '../schema'

export async function upsertPullRequest(data: {
  repoId: string
  githubPrNumber: number
  headSha: string
  baseSha: string
  title: string
  authorLogin: string
}) {
  const db = getDb()

  const [pr] = await db
    .insert(pullRequests)
    .values({
      repoId: data.repoId,
      githubPrNumber: data.githubPrNumber,
      headSha: data.headSha,
      baseSha: data.baseSha,
      title: data.title,
      authorLogin: data.authorLogin,
    })
    .onConflictDoUpdate({
      target: [pullRequests.repoId, pullRequests.githubPrNumber],
      set: {
        headSha: data.headSha,
        baseSha: data.baseSha,
        title: data.title,
        authorLogin: data.authorLogin,
        updatedAt: new Date(),
      },
    })
    .returning()

  return pr
}

export async function getPullRequestByRepoAndNumber(
  repoId: string,
  prNumber: number
) {
  const db = getDb()

  const [pr] = await db
    .select()
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.repoId, repoId),
        eq(pullRequests.githubPrNumber, prNumber)
      )
    )
    .limit(1)

  return pr ?? null
}

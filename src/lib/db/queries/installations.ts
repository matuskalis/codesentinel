import { eq } from 'drizzle-orm'
import type { AccountType } from '@/types'
import { getDb } from '../index'
import { githubInstallations } from '../schema'

export async function upsertInstallation(data: {
  githubInstallationId: number
  accountLogin: string
  accountType: AccountType
}) {
  const db = getDb()

  const [installation] = await db
    .insert(githubInstallations)
    .values({
      githubInstallationId: data.githubInstallationId,
      accountLogin: data.accountLogin,
      accountType: data.accountType,
    })
    .onConflictDoUpdate({
      target: githubInstallations.githubInstallationId,
      set: {
        accountLogin: data.accountLogin,
        accountType: data.accountType,
      },
    })
    .returning()

  return installation
}

export async function deleteInstallation(githubInstallationId: number) {
  const db = getDb()

  await db
    .delete(githubInstallations)
    .where(eq(githubInstallations.githubInstallationId, githubInstallationId))
}

export async function getInstallationByGithubId(githubInstallationId: number) {
  const db = getDb()

  const [installation] = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.githubInstallationId, githubInstallationId))
    .limit(1)

  return installation ?? null
}

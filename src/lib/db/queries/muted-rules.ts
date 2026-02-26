import { eq, and } from 'drizzle-orm'
import { getDb } from '../index'
import { mutedRules } from '../schema'

export async function createMutedRule(data: {
  repoId: string
  ruleId: string
  reason?: string
}) {
  const db = getDb()

  const [rule] = await db
    .insert(mutedRules)
    .values({
      repoId: data.repoId,
      ruleId: data.ruleId,
      reason: data.reason,
    })
    .returning()

  return rule
}

export async function deleteMutedRule(repoId: string, ruleId: string) {
  const db = getDb()

  await db
    .delete(mutedRules)
    .where(
      and(eq(mutedRules.repoId, repoId), eq(mutedRules.ruleId, ruleId))
    )
}

export async function listMutedRulesByRepo(repoId: string) {
  const db = getDb()

  return db
    .select()
    .from(mutedRules)
    .where(eq(mutedRules.repoId, repoId))
}

export async function getMutedRuleIds(repoId: string): Promise<string[]> {
  const db = getDb()

  const rows = await db
    .select({ ruleId: mutedRules.ruleId })
    .from(mutedRules)
    .where(eq(mutedRules.repoId, repoId))

  return rows.map((r) => r.ruleId)
}

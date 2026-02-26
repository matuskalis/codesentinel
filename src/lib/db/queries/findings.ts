import { eq, and, desc } from 'drizzle-orm'
import type { Severity, FindingStatus, InsertFindingDTO } from '@/types'
import { getDb } from '../index'
import { findings } from '../schema'

export async function bulkInsertFindings(findingDtos: InsertFindingDTO[]) {
  if (findingDtos.length === 0) {
    return []
  }

  const db = getDb()

  return db
    .insert(findings)
    .values(
      findingDtos.map((f) => ({
        scanId: f.scanId,
        repoId: f.repoId,
        ruleId: f.ruleId,
        ruleVersion: f.ruleVersion,
        severity: f.severity,
        confidence: f.confidence,
        title: f.title,
        description: f.description,
        explanation: f.explanation,
        fixSuggestion: f.fixSuggestion,
        filePath: f.filePath,
        startLine: f.startLine,
        endLine: f.endLine,
        snippet: f.snippet,
        fingerprint: f.fingerprint,
      }))
    )
    .returning()
}

export async function listFindingsByScan(scanId: string) {
  const db = getDb()

  return db
    .select()
    .from(findings)
    .where(eq(findings.scanId, scanId))
    .orderBy(desc(findings.severity))
}

export async function listFindingsByRepo(
  repoId: string,
  options?: {
    severity?: Severity
    status?: FindingStatus
    limit?: number
    offset?: number
  }
) {
  const db = getDb()
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  const conditions = [eq(findings.repoId, repoId)]

  if (options?.severity) {
    conditions.push(eq(findings.severity, options.severity))
  }

  if (options?.status) {
    conditions.push(eq(findings.status, options.status))
  }

  return db
    .select()
    .from(findings)
    .where(and(...conditions))
    .orderBy(desc(findings.severity))
    .limit(limit)
    .offset(offset)
}

export async function updateFindingStatus(
  findingId: string,
  status: FindingStatus
) {
  const db = getDb()

  const [finding] = await db
    .update(findings)
    .set({ status })
    .where(eq(findings.id, findingId))
    .returning()

  return finding
}

import { eq, desc, sql } from 'drizzle-orm'
import type { ScanStatus, CreateScanDTO, CompleteScanDTO } from '@/types'
import { getDb } from '../index'
import { scans, findings } from '../schema'

export async function createScan(dto: CreateScanDTO) {
  const db = getDb()

  const [scan] = await db
    .insert(scans)
    .values({
      repoId: dto.repoId,
      type: dto.type,
      commitSha: dto.commitSha,
      status: 'queued',
    })
    .returning()

  return scan
}

export async function updateScanStatus(
  scanId: string,
  status: ScanStatus,
  errorMessage?: string
) {
  const db = getDb()

  const updateData: Record<string, unknown> = { status }

  if (status === 'scanning') {
    updateData.startedAt = new Date()
  }

  if (status === 'failed' && errorMessage) {
    updateData.errorMessage = errorMessage
  }

  const [scan] = await db
    .update(scans)
    .set(updateData)
    .where(eq(scans.id, scanId))
    .returning()

  return scan
}

export async function completeScan(scanId: string, dto: CompleteScanDTO) {
  const db = getDb()

  const [scan] = await db
    .update(scans)
    .set({
      riskScore: dto.riskScore,
      riskLevel: dto.riskLevel,
      status: 'completed',
      completedAt: new Date(),
    })
    .where(eq(scans.id, scanId))
    .returning()

  return scan
}

export async function getScanById(scanId: string) {
  const db = getDb()

  const [scan] = await db
    .select({
      id: scans.id,
      repoId: scans.repoId,
      pullRequestId: scans.pullRequestId,
      type: scans.type,
      commitSha: scans.commitSha,
      status: scans.status,
      riskScore: scans.riskScore,
      riskLevel: scans.riskLevel,
      errorMessage: scans.errorMessage,
      startedAt: scans.startedAt,
      completedAt: scans.completedAt,
      createdAt: scans.createdAt,
      findingsCount: sql<number>`count(${findings.id})::int`,
    })
    .from(scans)
    .leftJoin(findings, eq(findings.scanId, scans.id))
    .where(eq(scans.id, scanId))
    .groupBy(scans.id)
    .limit(1)

  return scan ?? null
}

export async function listScansByRepo(
  repoId: string,
  options?: { limit?: number; offset?: number }
) {
  const db = getDb()
  const limit = options?.limit ?? 20
  const offset = options?.offset ?? 0

  return db
    .select()
    .from(scans)
    .where(eq(scans.repoId, repoId))
    .orderBy(desc(scans.createdAt))
    .limit(limit)
    .offset(offset)
}

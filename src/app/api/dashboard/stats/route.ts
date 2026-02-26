import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { getDb } from '@/lib/db'
import { repositories, scans, findings } from '@/lib/db/schema'
import { count, avg } from 'drizzle-orm'
import type { DashboardStats, Severity } from '@/types'

export async function GET() {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  // TODO: Scope queries to repos the authenticated user has access to via installation mapping
  const db = getDb()

  const [repoCount] = await db.select({ count: count() }).from(repositories)
  const [scanCount] = await db.select({ count: count() }).from(scans)
  const [findingCount] = await db.select({ count: count() }).from(findings)
  const [avgRisk] = await db
    .select({ avg: avg(scans.riskScore) })
    .from(scans)

  const severityCounts = await db
    .select({
      severity: findings.severity,
      count: count(),
    })
    .from(findings)
    .groupBy(findings.severity)

  const findingsBySeverity: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }

  for (const row of severityCounts) {
    if (row.severity in findingsBySeverity) {
      findingsBySeverity[row.severity as Severity] = row.count
    }
  }

  const stats: DashboardStats = {
    totalRepos: repoCount.count,
    totalScans: scanCount.count,
    totalFindings: findingCount.count,
    avgRiskScore: Math.round(Number(avgRisk.avg ?? 0)),
    findingsBySeverity,
  }

  return NextResponse.json({ data: stats })
}

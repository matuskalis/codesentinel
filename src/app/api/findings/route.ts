import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { listFindingsByRepo } from '@/lib/db/queries/findings'
import { getRepositoryById } from '@/lib/db/queries/repositories'
import type { Severity, FindingStatus } from '@/types'

const VALID_SEVERITIES: ReadonlySet<string> = new Set<Severity>([
  'critical',
  'high',
  'medium',
  'low',
])
const VALID_STATUSES: ReadonlySet<string> = new Set<FindingStatus>([
  'open',
  'muted',
  'resolved',
])

export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = request.nextUrl
  const repoId = searchParams.get('repoId')
  const severityParam = searchParams.get('severity')
  const statusParam = searchParams.get('status')
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1), 100)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)

  if (!repoId) {
    return NextResponse.json(
      { error: 'repoId is required' },
      { status: 400 }
    )
  }

  // TODO: Scope to repos the authenticated user has access to via installation mapping
  const repo = await getRepositoryById(repoId)
  if (!repo) {
    return NextResponse.json(
      { error: 'Repository not found' },
      { status: 404 }
    )
  }

  if (severityParam && !VALID_SEVERITIES.has(severityParam)) {
    return NextResponse.json(
      { error: `Invalid severity. Must be one of: ${[...VALID_SEVERITIES].join(', ')}` },
      { status: 400 }
    )
  }

  if (statusParam && !VALID_STATUSES.has(statusParam)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}` },
      { status: 400 }
    )
  }

  const severity = severityParam as Severity | null
  const status = statusParam as FindingStatus | null

  const findings = await listFindingsByRepo(repoId, {
    severity: severity ?? undefined,
    status: status ?? undefined,
    limit,
    offset,
  })

  return NextResponse.json({
    data: findings,
    meta: {
      page: Math.floor(offset / limit) + 1,
      limit,
      count: findings.length,
    },
  })
}

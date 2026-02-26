import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { listScansByRepo } from '@/lib/db/queries/scans'
import { getRepositoryById } from '@/lib/db/queries/repositories'

export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = request.nextUrl
  const repoId = searchParams.get('repoId')
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 100)
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

  const scans = await listScansByRepo(repoId, { limit, offset })

  return NextResponse.json({
    data: scans,
    meta: { page: Math.floor(offset / limit) + 1, limit, count: scans.length },
  })
}

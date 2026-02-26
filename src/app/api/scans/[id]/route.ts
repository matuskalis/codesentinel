import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { getScanById } from '@/lib/db/queries/scans'
import { listFindingsByScan } from '@/lib/db/queries/findings'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  // TODO: Scope to repos the authenticated user has access to via installation mapping
  const scan = await getScanById(id)
  if (!scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 })
  }

  const findings = await listFindingsByScan(id)

  return NextResponse.json({
    data: { ...scan, findings },
  })
}

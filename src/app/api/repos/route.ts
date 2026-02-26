import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { listActiveRepositories } from '@/lib/db/queries/repositories'

export async function GET() {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  // TODO: Scope to repos the authenticated user has access to via installation mapping
  const repos = await listActiveRepositories()

  return NextResponse.json({
    data: repos,
  })
}

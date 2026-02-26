import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import {
  createMutedRule,
  deleteMutedRule,
  listMutedRulesByRepo,
} from '@/lib/db/queries/muted-rules'
import { getRepositoryById } from '@/lib/db/queries/repositories'

export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const repoId = request.nextUrl.searchParams.get('repoId')
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

  const rules = await listMutedRulesByRepo(repoId)
  return NextResponse.json({ data: rules })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const body = (await request.json()) as {
    repoId?: string
    ruleId?: string
    reason?: string
  }

  if (!body.repoId || !body.ruleId) {
    return NextResponse.json(
      { error: 'repoId and ruleId are required' },
      { status: 400 }
    )
  }

  // TODO: Scope to repos the authenticated user has access to via installation mapping
  const repo = await getRepositoryById(body.repoId)
  if (!repo) {
    return NextResponse.json(
      { error: 'Repository not found' },
      { status: 404 }
    )
  }

  const rule = await createMutedRule({
    repoId: body.repoId,
    ruleId: body.ruleId,
    reason: body.reason,
  })
  return NextResponse.json({ data: rule }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const body = (await request.json()) as {
    repoId?: string
    ruleId?: string
  }

  if (!body.repoId || !body.ruleId) {
    return NextResponse.json(
      { error: 'repoId and ruleId are required' },
      { status: 400 }
    )
  }

  // TODO: Scope to repos the authenticated user has access to via installation mapping
  const repo = await getRepositoryById(body.repoId)
  if (!repo) {
    return NextResponse.json(
      { error: 'Repository not found' },
      { status: 404 }
    )
  }

  await deleteMutedRule(body.repoId, body.ruleId)
  return NextResponse.json({ ok: true })
}

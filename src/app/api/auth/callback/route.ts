import { NextRequest, NextResponse } from 'next/server'
import { verifyStateCookie, exchangeCode } from '@/lib/auth/github-oauth'
import { upsertUserByGithubId } from '@/lib/db/queries/users'
import { createUserSession } from '@/lib/auth/session'
import { getEnv } from '@/lib/env'

export async function GET(request: NextRequest) {
  const env = getEnv()
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')

  if (!code || !state) {
    return NextResponse.redirect(
      `${env.NEXT_PUBLIC_APP_URL}?error=missing_params`
    )
  }

  const validState = await verifyStateCookie(state)
  if (!validState) {
    return NextResponse.redirect(
      `${env.NEXT_PUBLIC_APP_URL}?error=invalid_state`
    )
  }

  try {
    const { githubUser } = await exchangeCode(code)

    const user = await upsertUserByGithubId({
      githubId: githubUser.id,
      login: githubUser.login,
      email: githubUser.email ?? undefined,
      avatarUrl: githubUser.avatar_url,
    })

    await createUserSession(user.id)

    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/dashboard`)
  } catch {
    return NextResponse.redirect(
      `${env.NEXT_PUBLIC_APP_URL}?error=auth_failed`
    )
  }
}

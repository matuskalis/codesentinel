import { cookies } from 'next/headers'
import { getEnv } from '@/lib/env'
import { randomBytes } from 'crypto'

const STATE_COOKIE = 'cs_oauth_state'

export function buildAuthUrl(): { url: string; state: string } {
  const env = getEnv()
  const state = randomBytes(32).toString('hex')

  const params = new URLSearchParams({
    client_id: env.GITHUB_APP_CLIENT_ID,
    redirect_uri: `${env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    scope: 'read:user user:email',
    state,
  })

  return {
    url: `https://github.com/login/oauth/authorize?${params.toString()}`,
    state,
  }
}

export async function setStateCookie(state: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })
}

export async function verifyStateCookie(state: string): Promise<boolean> {
  const cookieStore = await cookies()
  const storedState = cookieStore.get(STATE_COOKIE)?.value
  cookieStore.delete(STATE_COOKIE)
  return storedState === state
}

interface GitHubTokenResponse {
  access_token?: string
  error?: string
}

interface GitHubUser {
  id: number
  login: string
  email: string | null
  avatar_url: string
}

export async function exchangeCode(code: string): Promise<{
  accessToken: string
  githubUser: GitHubUser
}> {
  const env = getEnv()

  const tokenResponse = await fetch(
    'https://github.com/login/oauth/access_token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_APP_CLIENT_ID,
        client_secret: env.GITHUB_APP_CLIENT_SECRET,
        code,
      }),
    }
  )

  if (!tokenResponse.ok) {
    throw new Error(
      `OAuth token request failed with status ${tokenResponse.status}`
    )
  }

  const tokenData = (await tokenResponse.json()) as GitHubTokenResponse
  if (!tokenData.access_token) {
    throw new Error(
      `OAuth token exchange failed: ${tokenData.error ?? 'unknown error'}`
    )
  }

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!userResponse.ok) {
    throw new Error(
      `GitHub user fetch failed with status ${userResponse.status}`
    )
  }

  const githubUser = (await userResponse.json()) as GitHubUser

  return {
    accessToken: tokenData.access_token,
    githubUser,
  }
}

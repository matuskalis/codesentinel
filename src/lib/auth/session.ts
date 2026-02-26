import { SignJWT, jwtVerify } from 'jose'
import { createHash } from 'crypto'
import { cookies } from 'next/headers'
import { getEnv } from '@/lib/env'
import {
  createSession as dbCreateSession,
  getSessionByTokenHash,
  deleteSession as dbDeleteSession,
} from '@/lib/db/queries/sessions'

const SESSION_COOKIE = 'cs_session'
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 // 7 days in seconds

function getSecretKey(): Uint8Array {
  const env = getEnv()
  return new TextEncoder().encode(env.SESSION_SECRET)
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createUserSession(userId: string): Promise<string> {
  const secretKey = getSecretKey()

  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey)

  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000)
  await dbCreateSession({ userId, tokenHash, expiresAt })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })

  return token
}

export async function verifySession(): Promise<{ userId: string } | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    if (!token) return null

    const secretKey = getSecretKey()
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    })

    if (!payload.userId || typeof payload.userId !== 'string') return null

    const tokenHash = hashToken(token)
    const session = await getSessionByTokenHash(tokenHash)
    if (!session) return null

    return { userId: payload.userId as string }
  } catch {
    return null
  }
}

export async function deleteUserSession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    const tokenHash = hashToken(token)
    await dbDeleteSession(tokenHash)
  }

  cookieStore.delete(SESSION_COOKIE)
}

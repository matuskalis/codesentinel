import { eq, lt } from 'drizzle-orm'
import { getDb } from '../index'
import { sessions } from '../schema'

export async function createSession(data: {
  userId: string
  tokenHash: string
  expiresAt: Date
}) {
  const db = getDb()

  const [session] = await db
    .insert(sessions)
    .values({
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
    })
    .returning()

  return session
}

export async function getSessionByTokenHash(tokenHash: string) {
  const db = getDb()

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1)

  if (!session || session.expiresAt < new Date()) {
    return null
  }

  return session
}

export async function deleteExpiredSessions() {
  const db = getDb()

  await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
}

export async function deleteSession(tokenHash: string) {
  const db = getDb()

  await db
    .delete(sessions)
    .where(eq(sessions.tokenHash, tokenHash))
}

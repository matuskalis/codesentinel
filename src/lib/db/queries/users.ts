import { eq } from 'drizzle-orm'
import { getDb } from '../index'
import { users } from '../schema'

export async function upsertUserByGithubId(data: {
  githubId: number
  login: string
  email?: string
  avatarUrl?: string
}) {
  const db = getDb()

  const [user] = await db
    .insert(users)
    .values({
      githubId: data.githubId,
      login: data.login,
      email: data.email,
      avatarUrl: data.avatarUrl,
    })
    .onConflictDoUpdate({
      target: users.githubId,
      set: {
        login: data.login,
        email: data.email,
        avatarUrl: data.avatarUrl,
        updatedAt: new Date(),
      },
    })
    .returning()

  return user
}

export async function getUserById(userId: string) {
  const db = getDb()

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return user ?? null
}

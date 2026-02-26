import { eq } from 'drizzle-orm'
import { getDb } from '../index'
import { repositories } from '../schema'

export async function upsertRepository(data: {
  installationId: string
  githubRepoId: number
  fullName: string
  defaultBranch: string
}) {
  const db = getDb()

  const [repository] = await db
    .insert(repositories)
    .values({
      installationId: data.installationId,
      githubRepoId: data.githubRepoId,
      fullName: data.fullName,
      defaultBranch: data.defaultBranch,
    })
    .onConflictDoUpdate({
      target: repositories.githubRepoId,
      set: {
        fullName: data.fullName,
        defaultBranch: data.defaultBranch,
        installationId: data.installationId,
      },
    })
    .returning()

  return repository
}

export async function getRepositoryById(id: string) {
  const db = getDb()

  const [repository] = await db
    .select()
    .from(repositories)
    .where(eq(repositories.id, id))
    .limit(1)

  return repository ?? null
}

export async function getRepositoryByGithubId(githubRepoId: number) {
  const db = getDb()

  const [repository] = await db
    .select()
    .from(repositories)
    .where(eq(repositories.githubRepoId, githubRepoId))
    .limit(1)

  return repository ?? null
}

export async function listRepositoriesByInstallation(installationId: string) {
  const db = getDb()

  return db
    .select()
    .from(repositories)
    .where(eq(repositories.installationId, installationId))
}

export async function listActiveRepositories() {
  const db = getDb()

  return db
    .select()
    .from(repositories)
    .where(eq(repositories.isActive, true))
}

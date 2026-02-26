import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (!db) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL environment variable is required')
    const sql = postgres(url)
    db = drizzle(sql, { schema })
  }
  return db
}

export type Database = ReturnType<typeof getDb>

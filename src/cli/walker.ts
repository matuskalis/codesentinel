import * as fs from 'node:fs'
import * as path from 'node:path'
import type { FileChange } from '@/types'
import { shouldSkipFile, DEFAULT_SCAN_LIMITS } from '@/lib/scan-limits'

const MAX_FILE_BYTES = 512 * 1024
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.yml', '.yaml'])
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.git', 'coverage', '.turbo', '.vercel'])

function isEnvFile(name: string): boolean {
  return name === '.env' || name.startsWith('.env.')
}

export function walkDirectory(dir: string): string[] {
  const results: string[] = []
  let entries: fs.Dirent[]

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue

    const fullPath = path.join(dir, entry.name)

    if (entry.isSymbolicLink()) continue

    if (entry.isDirectory()) {
      results.push(...walkDirectory(fullPath))
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name)
      if (SCAN_EXTENSIONS.has(ext) || isEnvFile(entry.name)) {
        results.push(fullPath)
      }
    }
  }

  return results
}

export function buildFileChanges(dir: string): FileChange[] {
  const absoluteDir = path.resolve(dir)
  const allPaths = walkDirectory(absoluteDir)
  const files: FileChange[] = []

  for (const absPath of allPaths) {
    const relativePath = path.relative(absoluteDir, absPath)

    if (shouldSkipFile(relativePath, DEFAULT_SCAN_LIMITS)) continue

    try {
      const stat = fs.statSync(absPath)
      if (stat.size > MAX_FILE_BYTES) continue

      const content = fs.readFileSync(absPath, 'utf-8')
      const lineCount = content.split('\n').length

      files.push({
        filePath: relativePath,
        status: 'added',
        content,
        additions: [{ start: 1, end: lineCount }],
        deletions: [],
      })
    } catch {
      // Skip files that cannot be read
    }
  }

  return files
}

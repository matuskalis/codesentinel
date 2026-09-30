import * as fs from 'node:fs'
import * as path from 'node:path'
import { spawnSync } from 'node:child_process'
import type { FileChange } from '@/types'
import { shouldSkipFile, DEFAULT_SCAN_LIMITS } from '@/lib/scan-limits'

const MAX_FILE_BYTES = 512 * 1024
const GIT_OUTPUT_LIMIT_BYTES = 64 * 1024 * 1024
const SCAN_ROOT_PATH = '.'
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

function toGitPath(relativePath: string): string {
  return relativePath.split(path.sep).join('/')
}

// Files that .gitignore keeps out of the repository and that are not tracked anyway.
// Returns nothing when git is missing or the directory is not inside a repository.
// The repository's own git config is overridden so that scanning an untrusted checkout
// cannot make git run a command of its choosing.
// When a parent repository ignores the scan root itself, git reports every file under it
// as ignored. That says nothing about the files, so the signal is dropped and they are
// all scanned as if there were no git context.
function findGitIgnored(dir: string, relativePaths: string[]): Set<string> {
  if (relativePaths.length === 0) return new Set()

  const result = spawnSync('git', ['-c', 'core.fsmonitor=false', 'check-ignore', '-z', '--stdin'], {
    cwd: dir,
    input: [SCAN_ROOT_PATH, ...relativePaths.map(toGitPath)].join('\0'),
    encoding: 'utf-8',
    maxBuffer: GIT_OUTPUT_LIMIT_BYTES,
  })
  if (result.error || result.status !== 0) return new Set()

  const ignored = new Set(result.stdout.split('\0').filter(Boolean))
  return ignored.has(SCAN_ROOT_PATH) ? new Set() : ignored
}

export function buildFileChanges(dir: string): FileChange[] {
  const absoluteDir = path.resolve(dir)
  const candidates = walkDirectory(absoluteDir)
    .map(absPath => ({ absPath, relativePath: path.relative(absoluteDir, absPath) }))
    .filter(({ relativePath }) => !shouldSkipFile(relativePath, DEFAULT_SCAN_LIMITS))
  const gitIgnored = findGitIgnored(absoluteDir, candidates.map(candidate => candidate.relativePath))
  const files: FileChange[] = []

  for (const { absPath, relativePath } of candidates) {
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
        gitIgnored: gitIgnored.has(toGitPath(relativePath)),
      })
    } catch {
      // Skip files that cannot be read
    }
  }

  return files
}

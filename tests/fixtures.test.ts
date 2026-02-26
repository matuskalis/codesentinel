import { describe, it, expect, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { runScan } from '@/lib/scanner/index'
import type { FileChange } from '@/types'
import { shouldSkipFile, DEFAULT_SCAN_LIMITS } from '@/lib/scan-limits'

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
  createScanLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  createCorrelationLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

const MAX_FILE_BYTES = 512 * 1024
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.yml', '.yaml'])
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.git', 'coverage'])

const ROOT_DIR = path.resolve(import.meta.dirname, '..')
const FIXTURES_DIR = path.join(ROOT_DIR, 'fixtures')
const EXPECTED_DIR = path.join(ROOT_DIR, 'expected')

interface ExpectedFinding {
  rule_id: string
  severity: string
  confidence: string
  file: string
  start_line: number
  end_line: number
}

interface ExpectedFile {
  fixture: string
  findings: ExpectedFinding[]
}

function isEnvFile(name: string): boolean {
  return name === '.env' || name.startsWith('.env.')
}

function walkDir(dir: string): string[] {
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
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath))
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name)
      if (SCAN_EXTENSIONS.has(ext) || isEnvFile(entry.name)) {
        results.push(fullPath)
      }
    }
  }
  return results
}

function buildFileChange(filePath: string, relativePath: string): FileChange | null {
  try {
    const stat = fs.statSync(filePath)
    if (stat.size > MAX_FILE_BYTES) return null
    const content = fs.readFileSync(filePath, 'utf-8')
    const lineCount = content.split('\n').length
    return {
      filePath: relativePath,
      status: 'added',
      content,
      additions: [{ start: 1, end: lineCount }],
      deletions: [],
    }
  } catch {
    return null
  }
}

function sortFindings(findings: ExpectedFinding[]): ExpectedFinding[] {
  return [...findings].sort((a, b) =>
    a.file.localeCompare(b.file) || a.start_line - b.start_line || a.rule_id.localeCompare(b.rule_id)
  )
}

async function scanFixture(fixtureName: string): Promise<ExpectedFinding[]> {
  const fixtureDir = path.join(FIXTURES_DIR, fixtureName)
  const allPaths = walkDir(fixtureDir)
  const files: FileChange[] = []

  for (const absPath of allPaths) {
    const rel = path.relative(fixtureDir, absPath)
    if (shouldSkipFile(rel, DEFAULT_SCAN_LIMITS)) continue
    const fc = buildFileChange(absPath, rel)
    if (fc) files.push(fc)
  }

  const result = await runScan(files, [])

  return result.findings.map(f => ({
    rule_id: f.ruleId,
    severity: f.severity,
    confidence: f.confidence,
    file: f.filePath,
    start_line: f.startLine,
    end_line: f.endLine,
  }))
}

function loadExpected(fixtureName: string): ExpectedFinding[] {
  const expectedPath = path.join(EXPECTED_DIR, `${fixtureName}.json`)
  const raw = fs.readFileSync(expectedPath, 'utf-8')
  const parsed: ExpectedFile = JSON.parse(raw)
  return parsed.findings
}

function discoverFixtureNames(): string[] {
  return fs.readdirSync(EXPECTED_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
    .sort()
}

describe('Layer A fixture regression', () => {
  const fixtureNames = discoverFixtureNames()

  describe('all fixtures match expected output', () => {
    for (const fixtureName of fixtureNames) {
      it(`fixture: ${fixtureName}`, async () => {
        const actual = sortFindings(await scanFixture(fixtureName))
        const expected = sortFindings(loadExpected(fixtureName))

        expect(actual).toEqual(expected)
      })
    }
  })

  it('scanner output is deterministic (identical on re-run)', async () => {
    const run1 = sortFindings(await scanFixture('next-supabase-service-key-client'))
    const run2 = sortFindings(await scanFixture('next-supabase-service-key-client'))

    expect(run1).toEqual(run2)
  })

  it('line numbers shift when content changes', async () => {
    const fixturePath = path.join(FIXTURES_DIR, 'next-supabase-service-key-client', 'app', 'page.tsx')
    const originalContent = fs.readFileSync(fixturePath, 'utf-8')
    const modifiedContent = '\n\n' + originalContent
    const lineCount = modifiedContent.split('\n').length

    const file: FileChange = {
      filePath: 'app/page.tsx',
      status: 'added',
      content: modifiedContent,
      additions: [{ start: 1, end: lineCount }],
      deletions: [],
    }

    const result = await runScan([file], [])
    const finding = result.findings.find(f => f.ruleId === 'supabase-service-key-client')

    expect(finding).toBeDefined()
    expect(finding!.startLine).toBe(9)
  })
})

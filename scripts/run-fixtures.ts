import * as fs from 'node:fs'
import * as path from 'node:path'
import { runScan } from '@/lib/scanner'
import type { FileChange } from '@/types'
import { shouldSkipFile, DEFAULT_SCAN_LIMITS } from '@/lib/scan-limits'

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

function discoverFixtures(): string[] {
  return fs.readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()
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

async function runFixture(fixtureName: string): Promise<boolean> {
  const log = (msg: string) => process.stderr.write(msg + '\n')

  log(`\n--- ${fixtureName} ---`)

  const actual = sortFindings(await scanFixture(fixtureName))
  const expected = sortFindings(loadExpected(fixtureName))

  const actualJson = JSON.stringify(actual)
  const expectedJson = JSON.stringify(expected)

  if (actualJson === expectedJson) {
    log(`  PASS (${actual.length} findings)`)
    return true
  }

  log(`  FAIL`)
  log(`  Expected ${expected.length} findings, got ${actual.length}`)

  const expectedSet = new Set(expected.map(f => JSON.stringify(f)))
  const actualSet = new Set(actual.map(f => JSON.stringify(f)))

  for (const e of expected) {
    const key = JSON.stringify(e)
    if (!actualSet.has(key)) {
      log(`  MISSING: ${e.rule_id} in ${e.file}:${e.start_line}`)
    }
  }

  for (const a of actual) {
    const key = JSON.stringify(a)
    if (!expectedSet.has(key)) {
      log(`  EXTRA:   ${a.rule_id} in ${a.file}:${a.start_line}`)
    }
  }

  return false
}

async function main() {
  const targetFixture = process.argv[2]
  const fixtures = targetFixture ? [targetFixture] : discoverFixtures()

  let allPassed = true

  for (const fixture of fixtures) {
    const fixtureDir = path.join(FIXTURES_DIR, fixture)
    if (!fs.existsSync(fixtureDir)) {
      process.stderr.write(`Error: fixture directory not found: ${fixtureDir}\n`)
      process.exit(1)
    }

    const expectedPath = path.join(EXPECTED_DIR, `${fixture}.json`)
    if (!fs.existsSync(expectedPath)) {
      process.stderr.write(`Error: expected file not found: ${expectedPath}\n`)
      process.exit(1)
    }

    const passed = await runFixture(fixture)
    if (!passed) allPassed = false
  }

  process.stderr.write('\n')
  process.exit(allPassed ? 0 : 1)
}

main().catch(err => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})

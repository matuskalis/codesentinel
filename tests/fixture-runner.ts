import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { buildFileChanges } from '@/cli/walker'
import { runScan } from '@/lib/scanner'

const ROOT_DIR = path.resolve(import.meta.dirname, '..')
export const FIXTURES_DIR = path.join(ROOT_DIR, 'fixtures')
export const EXPECTED_DIR = path.join(ROOT_DIR, 'expected')

export interface ExpectedFinding {
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

export function discoverFixtureNames(): string[] {
  return fs.readdirSync(EXPECTED_DIR)
    .filter(name => name.endsWith('.json'))
    .map(name => name.replace(/\.json$/, ''))
    .sort()
}

export function loadExpected(fixtureName: string): ExpectedFinding[] {
  const raw = fs.readFileSync(path.join(EXPECTED_DIR, `${fixtureName}.json`), 'utf-8')
  const parsed: ExpectedFile = JSON.parse(raw)
  return parsed.findings
}

export function sortFindings(findings: ExpectedFinding[]): ExpectedFinding[] {
  return [...findings].sort((a, b) =>
    a.file.localeCompare(b.file) || a.start_line - b.start_line || a.rule_id.localeCompare(b.rule_id)
  )
}

function base64Url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

// Assembled at runtime so that no secret-shaped text is committed and GitHub push protection stays quiet.
const FAKE_VALUES: Record<string, string> = {
  'openai-key': `sk-${'abcdefghijklmnopqrstuvwxyz0123456789'}`,
  'supabase-anon-jwt': [
    base64Url({ alg: 'HS256', typ: 'JWT' }),
    base64Url({ iss: 'supabase', ref: 'abcdefghijklmnop', role: 'anon', iat: 1700000000, exp: 2015000000 }),
    createHash('sha256').update('codesentinel fixture, not a real signature').digest('base64url'),
  ].join('.'),
}

function fillPlaceholders(content: string): string {
  return content.replace(/\{\{([a-z-]+)\}\}/g, (_match, name: string) => {
    const value = FAKE_VALUES[name]
    if (value === undefined) throw new Error(`Unknown fixture placeholder: ${name}`)
    return value
  })
}

// .env* files cannot be committed here, so a fixture stores `_env.local` and it is scanned
// as `.env.local` with its {{placeholders}} filled in. Every other file is copied as it is.
function copyFixtureWithDotfiles(source: string, target: string): void {
  fs.mkdirSync(target, { recursive: true })
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const isDotfile = entry.name.startsWith('_')
    const from = path.join(source, entry.name)
    const to = path.join(target, isDotfile ? `.${entry.name.slice(1)}` : entry.name)

    if (entry.isDirectory()) copyFixtureWithDotfiles(from, to)
    else if (isDotfile) fs.writeFileSync(to, fillPlaceholders(fs.readFileSync(from, 'utf-8')))
    else fs.copyFileSync(from, to)
  }
}

export function countFixtureFiles(fixtureName: string): number {
  const walk = (dir: string): number =>
    fs.readdirSync(dir, { withFileTypes: true })
      .reduce((total, entry) => total + (entry.isDirectory() ? walk(path.join(dir, entry.name)) : 1), 0)
  return walk(path.join(FIXTURES_DIR, fixtureName))
}

export async function scanFixture(fixtureName: string): Promise<ExpectedFinding[]> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `codesentinel-fixture-${fixtureName}-`))
  try {
    copyFixtureWithDotfiles(path.join(FIXTURES_DIR, fixtureName), workDir)
    const result = await runScan(buildFileChanges(workDir), [])

    return result.findings.map(finding => ({
      rule_id: finding.ruleId,
      severity: finding.severity,
      confidence: finding.confidence,
      file: finding.filePath,
      start_line: finding.startLine,
      end_line: finding.endLine,
    }))
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true })
  }
}

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

// These run the committed dist/ bundles, the files users and the GitHub Action execute,
// not the TypeScript sources. CI separately checks that dist/ matches a fresh build.
const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..')
const CLI_BUNDLE = path.join(PROJECT_ROOT, 'dist', 'codesentinel.mjs')
const ACTION_BUNDLE = path.join(PROJECT_ROOT, 'dist', 'action.mjs')
const SUPABASE_FIXTURE = 'fixtures/next-supabase-service-key-client'
const STRIPE_FIXTURE = 'fixtures/next-stripe-webhook-no-verify'
const CUT_SHORT = { CODESENTINEL_SCAN_TIMEOUT_MS: '0' }

let outputDir: string
let outputCounter = 0

beforeAll(() => {
  outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesentinel-bundles-'))
})

afterAll(() => {
  fs.rmSync(outputDir, { recursive: true, force: true })
})

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '')
}

function runCliBundle(args: string[], extraEnv: Record<string, string> = {}) {
  const result = spawnSync('node', [CLI_BUNDLE, ...args], {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
    env: { ...process.env, ...extraEnv },
  })
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.status }
}

function runActionBundle(inputs: { directory: string; failOn: string }, extraEnv: Record<string, string> = {}) {
  const outputFile = path.join(outputDir, `github-output-${outputCounter++}`)
  fs.writeFileSync(outputFile, '')
  const result = spawnSync('node', [ACTION_BUNDLE], {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
    env: {
      ...process.env,
      INPUT_DIRECTORY: inputs.directory,
      INPUT_FAIL_ON: inputs.failOn,
      GITHUB_OUTPUT: outputFile,
      ...extraEnv,
    },
  })
  return { stdout: result.stdout, exitCode: result.status, outputs: fs.readFileSync(outputFile, 'utf-8') }
}

describe('dist/codesentinel.mjs', () => {
  it('prints its version', () => {
    const { stdout, exitCode } = runCliBundle(['--version'])

    expect(exitCode).toBe(0)
    expect(stdout.trim()).toMatch(/^codesentinel v\d+\.\d+\.\d+$/)
  })

  it('scans a fixture, names the rule and exits 1', () => {
    const { stdout, exitCode } = runCliBundle(['scan', SUPABASE_FIXTURE])

    expect(exitCode).toBe(1)
    expect(stdout).toContain('app/page.tsx:7  supabase-service-key-client')
  })

  it('prints JSON findings for a fixture', () => {
    const { stdout } = runCliBundle(['scan', SUPABASE_FIXTURE, '--json'])
    const parsed = JSON.parse(stdout)

    expect(parsed.findings).toHaveLength(1)
    expect(parsed.findings[0]).toMatchObject({ ruleId: 'supabase-service-key-client', startLine: 7, severity: 'critical' })
  })

  it('exits 2 on a missing directory', () => {
    const { stderr, exitCode } = runCliBundle(['scan', 'does-not-exist'])

    expect(exitCode).toBe(2)
    expect(stderr).toContain('directory not found')
  })

  it('exits 3 and does not say passed when the time limit cuts the scan short', () => {
    const { stdout, exitCode } = runCliBundle(['scan', STRIPE_FIXTURE], CUT_SHORT)
    const output = stripAnsi(stdout)

    expect(exitCode).toBe(3)
    expect(output).toContain('Time limit reached: 3 files were not scanned')
    expect(output).toContain('Scan incomplete, not a pass')
    expect(output).not.toContain('Scan passed')
    expect(output).not.toContain('clean scan')
  })
})

describe('dist/action.mjs', () => {
  it('annotates a blocking finding, writes the outputs and exits 1', () => {
    const { stdout, exitCode, outputs } = runActionBundle({ directory: SUPABASE_FIXTURE, failOn: 'high' })

    expect(exitCode).toBe(1)
    expect(stdout).toContain(
      '::error file=app/page.tsx,line=7,endLine=7,title=Supabase service role key used in client code::'
    )
    expect(stdout).toContain('Scan failed.')
    expect(outputs).toBe('findings-count=1\nrisk-score=25\nrisk-level=medium\n')
  })

  it('escapes line breaks in the annotation message', () => {
    const { stdout } = runActionBundle({ directory: SUPABASE_FIXTURE, failOn: 'high' })
    const annotation = stdout.split('\n').find(line => line.startsWith('::error file='))

    expect(annotation).toContain('%0A%0AFix: ')
    expect(annotation).not.toContain('\r')
  })

  it('annotates a medium-confidence finding but passes, and still writes the outputs', () => {
    const { stdout, exitCode, outputs } = runActionBundle({ directory: STRIPE_FIXTURE, failOn: 'high' })

    expect(exitCode).toBe(0)
    expect(stdout).toContain('::error file=app/api/stripe/webhook/route.ts,line=1')
    expect(stdout).toContain('scan passed: no blocking findings')
    expect(outputs).toBe('findings-count=1\nrisk-score=9\nrisk-level=low\n')
  })

  it('blocks the same finding at fail-on low', () => {
    expect(runActionBundle({ directory: STRIPE_FIXTURE, failOn: 'low' }).exitCode).toBe(1)
  })

  it('warns, fails with exit 3 and still writes the outputs when the time limit cuts the scan short', () => {
    const { stdout, exitCode, outputs } = runActionBundle({ directory: STRIPE_FIXTURE, failOn: 'high' }, CUT_SHORT)

    expect(exitCode).toBe(3)
    expect(stdout).toContain('::warning::CodeSentinel scan incomplete: 3 files were not scanned')
    expect(stdout).toContain('::error::CodeSentinel scan incomplete')
    expect(stdout).not.toContain('scan passed')
    expect(outputs).toBe('findings-count=0\nrisk-score=0\nrisk-level=low\n')
  })

  it('rejects an unknown fail-on value with exit 2', () => {
    const { stdout, exitCode } = runActionBundle({ directory: '.', failOn: 'severe' })

    expect(exitCode).toBe(2)
    expect(stdout).toContain('::error::Invalid fail-on value: "severe"')
  })

  it('rejects a missing directory with exit 2', () => {
    const { stdout, exitCode } = runActionBundle({ directory: 'does-not-exist', failOn: 'high' })

    expect(exitCode).toBe(2)
    expect(stdout).toContain('::error::Directory not found')
  })
})

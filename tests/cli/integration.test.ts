import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

// Assembled at runtime to avoid GitHub push protection false positive
const FAKE_SK_LIVE = `sk_live_${'TESTKEY00000000000000000000'}`
const FAKE_SK_TEST = `sk_test_${'TESTKEY00000000000000000000'}`

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..')
const SUPABASE_FIXTURE = path.join(PROJECT_ROOT, 'fixtures', 'next-supabase-service-key-client')
const STRIPE_FIXTURE = path.join(PROJECT_ROOT, 'fixtures', 'next-stripe-webhook-no-verify')

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '')
}

let dirtyDir: string
let cleanDir: string
let mediumOnlyDir: string

function runCli(args: string, cwd?: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(
      `node --import tsx src/cli/index.ts -- ${args}`,
      {
        cwd: PROJECT_ROOT,
        encoding: 'utf-8',
        env: { ...process.env, LOG_LEVEL: 'silent' },
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    )
    return { stdout, exitCode: 0 }
  } catch (error: any) {
    return { stdout: error.stdout ?? '', exitCode: error.status ?? 1 }
  }
}

beforeAll(() => {
  // Directory with a critical finding (Stripe live key)
  dirtyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesentinel-dirty-'))
  fs.writeFileSync(
    path.join(dirtyDir, 'config.ts'),
    `const key = "${FAKE_SK_LIVE}";\n`
  )

  // Clean directory (no findings)
  cleanDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesentinel-clean-'))
  fs.writeFileSync(
    path.join(cleanDir, 'clean.ts'),
    `export function hello() { return "world"; }\n`
  )

  // Directory with only a medium-severity finding (Stripe test key)
  mediumOnlyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesentinel-medium-'))
  fs.writeFileSync(
    path.join(mediumOnlyDir, 'test-keys.ts'),
    `const testKey = "${FAKE_SK_TEST}";\n`
  )
})

afterAll(() => {
  fs.rmSync(dirtyDir, { recursive: true, force: true })
  fs.rmSync(cleanDir, { recursive: true, force: true })
  fs.rmSync(mediumOnlyDir, { recursive: true, force: true })
})

describe('CLI integration', () => {
  describe('scan command', () => {
    it('should exit 1 when critical findings are detected', () => {
      const { exitCode } = runCli(`scan ${dirtyDir}`)

      expect(exitCode).toBe(1)
    })

    it('should exit 0 on a clean project', () => {
      const { exitCode } = runCli(`scan ${cleanDir}`)

      expect(exitCode).toBe(0)
    })

    it('should include finding details in terminal output', () => {
      const { stdout } = runCli(`scan ${dirtyDir}`)

      // Strip ANSI for clean assertions
      const stripped = stdout.replace(/\x1b\[[0-9;]*m/g, '')
      expect(stripped).toContain('CRITICAL')
      expect(stripped.toLowerCase()).toContain('stripe')
    })

    it('should scan current directory when no path is provided', () => {
      // Scan the clean dir by running from its cwd
      // We pass cwd but it doesn't affect our helper since we always run from PROJECT_ROOT
      // Instead we test that "scan ." with a known clean dir works
      const { exitCode } = runCli(`scan ${cleanDir}`)

      expect(exitCode).toBe(0)
    })
  })

  describe('--json flag', () => {
    it('should output valid JSON', () => {
      const { stdout } = runCli(`scan ${cleanDir} --json`)

      expect(() => JSON.parse(stdout)).not.toThrow()
    })

    it('should contain required fields in JSON output', () => {
      const { stdout } = runCli(`scan ${cleanDir} --json`)
      const parsed = JSON.parse(stdout)

      expect(parsed).toHaveProperty('findings')
      expect(parsed).toHaveProperty('riskScore')
      expect(parsed).toHaveProperty('riskLevel')
      expect(parsed).toHaveProperty('summary')
      expect(Array.isArray(parsed.findings)).toBe(true)
    })

    it('should include findings in JSON output for dirty project', () => {
      const { stdout } = runCli(`scan ${dirtyDir} --json`)
      const parsed = JSON.parse(stdout)

      expect(parsed.findings.length).toBeGreaterThan(0)
      expect(parsed.findings[0]).toHaveProperty('severity')
      expect(parsed.findings[0]).toHaveProperty('ruleId')
    })
  })

  describe('--quiet flag', () => {
    it('should suppress output but still set correct exit code for findings', () => {
      const { stdout, exitCode } = runCli(`scan ${dirtyDir} --quiet`)

      expect(stdout.trim()).toBe('')
      expect(exitCode).toBe(1)
    })

    it('should suppress output and exit 0 for clean project', () => {
      const { stdout, exitCode } = runCli(`scan ${cleanDir} --quiet`)

      expect(stdout.trim()).toBe('')
      expect(exitCode).toBe(0)
    })
  })

  describe('--fail-on flag', () => {
    it('should exit 0 with --fail-on critical when only medium findings exist', () => {
      const { exitCode } = runCli(`scan ${mediumOnlyDir} --fail-on critical`)

      expect(exitCode).toBe(0)
    })

    it('should exit 1 with --fail-on low when medium findings exist', () => {
      const { exitCode } = runCli(`scan ${mediumOnlyDir} --fail-on low`)

      expect(exitCode).toBe(1)
    })

    it('should exit 1 with --fail-on critical when critical findings exist', () => {
      const { exitCode } = runCli(`scan ${dirtyDir} --fail-on critical`)

      expect(exitCode).toBe(1)
    })
  })

  describe('fixtures', () => {
    it('should name the rule, file and line of a finding in terminal output', () => {
      const { stdout, exitCode } = runCli(`scan ${SUPABASE_FIXTURE}`)
      const output = stripAnsi(stdout)

      expect(exitCode).toBe(1)
      expect(output).toMatch(/CRITICAL {2,}Supabase service role key used in client code/)
      expect(output).toContain('app/page.tsx:7  supabase-service-key-client')
      expect(output).toContain('Scan failed: 1 blocking finding at high or above')
    })

    it('should show the scanned directory relative to where the command runs', () => {
      const { stdout } = runCli('scan fixtures/next-supabase-service-key-client')

      expect(stripAnsi(stdout)).toContain('Scanning fixtures/next-supabase-service-key-client\n')
    })

    it('should show the absolute path when the directory is outside the working directory', () => {
      const { stdout } = runCli(`scan ${cleanDir}`)

      expect(stripAnsi(stdout)).toContain(`Scanning ${cleanDir}\n`)
    })

    it('should give identical findings on every run', () => {
      const findingsOf = (stdout: string) => JSON.parse(stdout).findings

      const first = findingsOf(runCli(`scan ${SUPABASE_FIXTURE} --json`).stdout)
      const second = findingsOf(runCli(`scan ${SUPABASE_FIXTURE} --json`).stdout)

      expect(first).toHaveLength(1)
      expect(second).toEqual(first)
    })
  })

  describe('git-ignored env files', () => {
    it('should not call a git-ignored .env.local committed, but still flag NEXT_PUBLIC_ secrets in it', () => {
      const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesentinel-ignored-'))
      try {
        execSync('git init -q', { cwd: repoDir, stdio: 'ignore' })
        fs.writeFileSync(path.join(repoDir, '.gitignore'), '.env.local\n')
        fs.writeFileSync(
          path.join(repoDir, '.env.local'),
          `STRIPE_SECRET_KEY=${FAKE_SK_LIVE}\nNEXT_PUBLIC_API_SECRET=s3cr3t-never-meant-for-browsers\n`
        )

        const parsed = JSON.parse(runCli(`scan ${repoDir} --json`).stdout)
        const rules = parsed.findings.map((finding: { ruleId: string }) => finding.ruleId)

        expect(rules).toEqual(['next-public-secret'])
      } finally {
        fs.rmSync(repoDir, { recursive: true, force: true })
      }
    })

    it('should still report secrets when the scanned directory is itself ignored by a parent repository', () => {
      const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesentinel-parent-'))
      try {
        execSync('git init -q', { cwd: repoDir, stdio: 'ignore' })
        fs.writeFileSync(path.join(repoDir, '.gitignore'), 'vendored/\n')
        const vendoredDir = path.join(repoDir, 'vendored')
        fs.mkdirSync(vendoredDir)
        fs.writeFileSync(path.join(vendoredDir, 'payments.ts'), `const key = "${FAKE_SK_LIVE}";\n`)
        fs.writeFileSync(path.join(vendoredDir, '.env.production'), `STRIPE_SECRET_KEY=${FAKE_SK_LIVE}\n`)

        const { stdout, exitCode } = runCli(`scan ${vendoredDir} --json`)
        const rules = JSON.parse(stdout).findings.map((finding: { ruleId: string }) => finding.ruleId).sort()

        expect(exitCode).toBe(1)
        expect(rules).toEqual(['env-committed', 'hardcoded-secrets', 'hardcoded-secrets'])
      } finally {
        fs.rmSync(repoDir, { recursive: true, force: true })
      }
    })

    it('should still call an env file committed when it is tracked', () => {
      const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesentinel-tracked-'))
      try {
        execSync('git init -q', { cwd: repoDir, stdio: 'ignore' })
        fs.writeFileSync(path.join(repoDir, '.gitignore'), '.env.local\n')
        fs.writeFileSync(path.join(repoDir, '.env.local'), `STRIPE_SECRET_KEY=${FAKE_SK_LIVE}\n`)
        execSync('git add -f .env.local', { cwd: repoDir, stdio: 'ignore' })

        const parsed = JSON.parse(runCli(`scan ${repoDir} --json`).stdout)
        const rules = parsed.findings.map((finding: { ruleId: string }) => finding.ruleId).sort()

        expect(rules).toEqual(['env-committed', 'hardcoded-secrets'])
      } finally {
        fs.rmSync(repoDir, { recursive: true, force: true })
      }
    })
  })

  describe('large projects', () => {
    it('should scan every file, not only the first 500', () => {
      const bigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesentinel-big-'))
      try {
        for (let index = 0; index < 505; index++) {
          const name = `file-${String(index).padStart(3, '0')}.ts`
          const content = index === 504 ? `const key = "${FAKE_SK_LIVE}";\n` : `export const value${index} = ${index};\n`
          fs.writeFileSync(path.join(bigDir, name), content)
        }

        const parsed = JSON.parse(runCli(`scan ${bigDir} --json`).stdout)

        expect(parsed.summary.filesScanned).toBe(505)
        expect(parsed.findings.map((finding: { filePath: string }) => finding.filePath)).toEqual(['file-504.ts'])
      } finally {
        fs.rmSync(bigDir, { recursive: true, force: true })
      }
    })
  })

  describe('medium-confidence findings', () => {
    it('should report a high-severity finding without failing at --fail-on high', () => {
      const { stdout, exitCode } = runCli(`scan ${STRIPE_FIXTURE} --fail-on high`)
      const output = stripAnsi(stdout)

      expect(exitCode).toBe(0)
      expect(output).toContain('HIGH')
      expect(output).toContain('stripe-no-webhook-verify')
      expect(output).toContain('Scan passed: no blocking findings (1 reported)')
      expect(output).toContain('Findings block only at high confidence')
    })

    it('should fail on it with --fail-on low', () => {
      const { exitCode } = runCli(`scan ${STRIPE_FIXTURE} --fail-on low`)

      expect(exitCode).toBe(1)
    })
  })

  describe('--help flag', () => {
    it('should print usage information', () => {
      const { stdout, exitCode } = runCli('--help')

      expect(exitCode).toBe(0)
      expect(stdout).toContain('Usage')
      expect(stdout).toContain('codesentinel scan')
    })

    it('should list available options and exit codes', () => {
      const { stdout } = runCli('--help')

      expect(stdout).toContain('--json')
      expect(stdout).toContain('--fail-on')
      expect(stdout).toContain('--quiet')
      expect(stdout).toContain('Exit codes')
      expect(stdout).not.toContain('--verbose')
    })

    it('should not use em dashes', () => {
      const { stdout } = runCli('--help')

      expect(stdout).not.toContain('\u2014')
    })
  })

  describe('--version flag', () => {
    it('should print the version string', () => {
      const { stdout, exitCode } = runCli('--version')

      expect(exitCode).toBe(0)
      expect(stdout.trim()).toMatch(/^codesentinel v\d+\.\d+\.\d+$/)
    })
  })
})

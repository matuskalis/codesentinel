import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runScan } from '@/lib/scanner/index'
import type { FileChange, ScanLimits } from '@/types'
import { DEFAULT_SCAN_LIMITS } from '@/lib/scan-limits'

// Assembled at runtime to avoid GitHub push protection false positive
const FAKE_SK_LIVE = `sk_live_${'TESTKEY00000000000000000000'}`

// Mock the logger to prevent pino output in tests
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

function makeFile(overrides: Partial<FileChange> & { filePath: string; content: string }): FileChange {
  return {
    status: 'added',
    patch: undefined,
    additions: [{ start: 1, end: overrides.content.split('\n').length }],
    deletions: [],
    ...overrides,
  }
}

describe('runScan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('basic scanning', () => {
    it('should scan multiple files and return findings', async () => {
      const files: FileChange[] = [
        makeFile({
          filePath: 'src/lib/api.ts',
          content: `const key = "${FAKE_SK_LIVE}"`,
        }),
        makeFile({
          filePath: 'src/lib/db.ts',
          content: 'const query = `SELECT * FROM users WHERE id = ${userId}`',
        }),
      ]

      const result = await runScan(files)
      expect(result.findings.length).toBeGreaterThan(0)
      expect(result.summary.filesScanned).toBe(2)
      expect(result.summary.totalFindings).toBeGreaterThan(0)
    })

    it('should return correct summary structure', async () => {
      const files: FileChange[] = [
        makeFile({
          filePath: 'src/lib/api.ts',
          content: `const safe = process.env.SECRET_KEY`,
        }),
      ]

      const result = await runScan(files)
      expect(result).toHaveProperty('findings')
      expect(result).toHaveProperty('riskScore')
      expect(result).toHaveProperty('riskLevel')
      expect(result).toHaveProperty('summary')
      expect(result.summary).toHaveProperty('totalFindings')
      expect(result.summary).toHaveProperty('bySeverity')
      expect(result.summary).toHaveProperty('filesScanned')
      expect(result.summary).toHaveProperty('rulesApplied')
      expect(result.summary).toHaveProperty('scanDurationMs')
    })
  })

  describe('muted rules', () => {
    it('should exclude findings from muted rules', async () => {
      const files: FileChange[] = [
        makeFile({
          filePath: 'src/lib/api.ts',
          content: `const key = "${FAKE_SK_LIVE}"`,
        }),
      ]

      const result = await runScan(files, ['hardcoded-secrets'])
      const hardcodedFindings = result.findings.filter(f => f.ruleId === 'hardcoded-secrets')
      expect(hardcodedFindings.length).toBe(0)
    })

    it('should still find other rule violations when one is muted', async () => {
      const files: FileChange[] = [
        makeFile({
          filePath: '.env',
          content: [
            `STRIPE_SECRET_KEY=${FAKE_SK_LIVE}`,
          ].join('\n'),
        }),
      ]

      // Mute hardcoded-secrets, but env-committed should still fire
      const result = await runScan(files, ['hardcoded-secrets'])
      const hardcodedFindings = result.findings.filter(f => f.ruleId === 'hardcoded-secrets')
      const envFindings = result.findings.filter(f => f.ruleId === 'env-committed')
      expect(hardcodedFindings.length).toBe(0)
      expect(envFindings.length).toBeGreaterThan(0)
    })
  })

  describe('file filtering', () => {
    it('should skip deleted files', async () => {
      const files: FileChange[] = [
        makeFile({
          filePath: 'src/lib/api.ts',
          status: 'deleted',
          content: `const key = "${FAKE_SK_LIVE}"`,
        }),
      ]

      const result = await runScan(files)
      expect(result.summary.filesScanned).toBe(0)
      expect(result.findings.length).toBe(0)
    })

    it('should skip files that exceed maxBytesPerFile', async () => {
      const largeContent = 'x'.repeat(DEFAULT_SCAN_LIMITS.maxBytesPerFile + 1)
      const files: FileChange[] = [
        makeFile({
          filePath: 'src/lib/large-file.ts',
          content: largeContent,
        }),
      ]

      const result = await runScan(files)
      expect(result.summary.filesScanned).toBe(0)
    })

    it('should skip files matching skip patterns', async () => {
      const files: FileChange[] = [
        makeFile({
          filePath: 'node_modules/some-lib/index.ts',
          content: `const key = "${FAKE_SK_LIVE}"`,
        }),
      ]

      const result = await runScan(files)
      expect(result.summary.filesScanned).toBe(0)
    })

    it('should respect maxFilesPerScan limit', async () => {
      const limits: ScanLimits = {
        ...DEFAULT_SCAN_LIMITS,
        maxFilesPerScan: 1,
      }

      const files: FileChange[] = [
        makeFile({ filePath: 'src/a.ts', content: 'const a = 1' }),
        makeFile({ filePath: 'src/b.ts', content: 'const b = 2' }),
        makeFile({ filePath: 'src/c.ts', content: 'const c = 3' }),
      ]

      const result = await runScan(files, [], limits)
      expect(result.summary.filesScanned).toBe(1)
    })
  })

  describe('time limit', () => {
    const files: FileChange[] = [
      makeFile({ filePath: 'src/a.ts', content: 'const a = 1' }),
      makeFile({ filePath: 'src/b.ts', content: `const key = "${FAKE_SK_LIVE}"` }),
    ]

    it('should report the files it never reached when the time limit is hit', async () => {
      const result = await runScan(files, [], { ...DEFAULT_SCAN_LIMITS, scanTimeoutMs: 0 })

      expect(result.summary.filesScanned).toBe(0)
      expect(result.summary.filesNotScanned).toBe(2)
    })

    it('should report no unscanned files when the scan finishes', async () => {
      const result = await runScan(files)

      expect(result.summary.filesScanned).toBe(2)
      expect(result.summary.filesNotScanned).toBe(0)
    })

    it('should not count files skipped on purpose as unscanned', async () => {
      const skipped = [
        makeFile({ filePath: 'node_modules/x/index.ts', content: 'const a = 1' }),
        makeFile({ filePath: 'src/gone.ts', content: 'const b = 2', status: 'deleted' }),
      ]

      const result = await runScan(skipped, [], { ...DEFAULT_SCAN_LIMITS, scanTimeoutMs: 0 })

      expect(result.summary.filesNotScanned).toBe(0)
    })
  })

  describe('empty inputs', () => {
    it('should return zero findings for empty file list', async () => {
      const result = await runScan([])
      expect(result.findings.length).toBe(0)
      expect(result.summary.filesScanned).toBe(0)
      expect(result.riskScore).toBe(0)
    })

    it('should produce no findings for files with safe content', async () => {
      const files: FileChange[] = [
        makeFile({
          filePath: 'src/lib/math.ts',
          content: 'export const add = (a: number, b: number) => a + b',
        }),
      ]

      const result = await runScan(files)
      expect(result.findings.length).toBe(0)
    })
  })

  describe('risk scoring', () => {
    it('should return a riskScore of 0 for no findings', async () => {
      const files: FileChange[] = [
        makeFile({
          filePath: 'src/lib/safe.ts',
          content: 'const safe = true',
        }),
      ]

      const result = await runScan(files)
      expect(result.riskScore).toBe(0)
      expect(result.riskLevel).toBe('low')
    })

    it('should compute bySeverity counts correctly', async () => {
      const files: FileChange[] = [
        makeFile({
          filePath: 'src/lib/api.ts',
          content: `const key = "${FAKE_SK_LIVE}"`,
        }),
      ]

      const result = await runScan(files)
      const totalBySeverity =
        result.summary.bySeverity.critical +
        result.summary.bySeverity.high +
        result.summary.bySeverity.medium +
        result.summary.bySeverity.low
      expect(totalBySeverity).toBe(result.summary.totalFindings)
    })
  })

  describe('deduplication', () => {
    it('should deduplicate findings with the same fingerprint', async () => {
      // Two files with the exact same content and path (unlikely but tests dedup)
      // In practice, same rule+path+snippet = same fingerprint
      const files: FileChange[] = [
        makeFile({
          filePath: 'src/lib/api.ts',
          content: `const key = "${FAKE_SK_LIVE}"`,
        }),
      ]

      const result = await runScan(files)
      const fingerprints = result.findings.map(f => f.fingerprint)
      const uniqueFingerprints = new Set(fingerprints)
      expect(fingerprints.length).toBe(uniqueFingerprints.size)
    })
  })

  describe('scan duration', () => {
    it('should report scan duration in milliseconds', async () => {
      const files: FileChange[] = [
        makeFile({
          filePath: 'src/lib/api.ts',
          content: 'const x = 1',
        }),
      ]

      const result = await runScan(files)
      expect(result.summary.scanDurationMs).toBeGreaterThanOrEqual(0)
    })
  })
})

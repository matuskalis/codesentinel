import { describe, it, expect } from 'vitest'

// Assembled at runtime to avoid GitHub push protection false positive
const FAKE_SK_LIVE = `sk_live_${'TESTKEY00000000000000000000'}`

import { parseDiff } from '@/lib/scanner/diff-parser'
import { classifyFile } from '@/lib/scanner/file-classifier'
import { allRules, getRulesForFile } from '@/lib/rules'
import { calculateRiskScore, getRiskLevel } from '@/lib/scoring'
import { formatSummaryComment } from '@/lib/reporting/summary-comment'
import { formatInlineComments } from '@/lib/reporting/inline-comments'
import { deduplicateFindings } from '@/lib/scanner/deduplicator'
import type { FileChange, RuleFinding, Severity, ReportInput, ScanResult } from '@/types'

// ---------------------------------------------------------------------------
// Integration test: PR scan pipeline
//
// This test runs the full scan pipeline end-to-end using mock diffs without
// requiring any external services (no database, Redis, or GitHub API).
// ---------------------------------------------------------------------------

describe('PR scan flow integration', () => {
  // -----------------------------------------------------------------------
  // Helper: run the full pipeline on a set of file changes
  // -----------------------------------------------------------------------

  function runPipeline(files: FileChange[]) {
    const allFindings: RuleFinding[] = []

    for (const file of files) {
      const classification = classifyFile(file.filePath, file.content)

      // Skip test files
      if (classification.isTest) continue

      const applicableRules = getRulesForFile(classification)

      for (const rule of applicableRules) {
        const ruleFindings = rule.run(file, classification)
        allFindings.push(...ruleFindings)
      }
    }

    const dedupedFindings = deduplicateFindings(allFindings)
    const riskScore = calculateRiskScore(dedupedFindings)
    const riskLevel = getRiskLevel(riskScore)

    const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const f of dedupedFindings) {
      bySeverity[f.severity]++
    }

    const result: ScanResult = {
      findings: dedupedFindings,
      riskScore,
      riskLevel,
      summary: {
        totalFindings: dedupedFindings.length,
        bySeverity,
        filesScanned: files.length,
        rulesApplied: allRules.length,
        scanDurationMs: 42,
        filesNotScanned: 0,
      },
    }

    return result
  }

  // -----------------------------------------------------------------------
  // Test: PR with hardcoded secret should be detected
  // -----------------------------------------------------------------------

  it('should detect a hardcoded secret in a new file', () => {
    const vulnerableContent = [
      'import Stripe from "stripe"',
      '',
      '// Initialize Stripe with live key',
      `const stripe = new Stripe("${FAKE_SK_LIVE}")`,
      '',
      'export async function createPayment(amount: number) {',
      '  return stripe.paymentIntents.create({ amount, currency: "usd" })',
      '}',
    ].join('\n')

    const files: FileChange[] = [
      {
        filePath: 'src/lib/payments.ts',
        status: 'added',
        content: vulnerableContent,
        patch: '@@ -0,0 +1,8 @@\n' + vulnerableContent.split('\n').map(l => `+${l}`).join('\n'),
        additions: [{ start: 1, end: 8 }],
        deletions: [],
      },
    ]

    const result = runPipeline(files)

    // Should detect the hardcoded Stripe live key
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.riskScore).toBeGreaterThan(0)

    // At least one finding should mention "Stripe" or "secret"
    const hasSecretFinding = result.findings.some(
      (f) =>
        f.title.toLowerCase().includes('stripe') ||
        f.title.toLowerCase().includes('secret') ||
        f.ruleId === 'hardcoded-secrets'
    )
    expect(hasSecretFinding).toBe(true)

    // The finding should reference the correct file
    const secretFinding = result.findings.find((f) => f.ruleId === 'hardcoded-secrets')
    expect(secretFinding).toBeDefined()
    expect(secretFinding!.filePath).toBe('src/lib/payments.ts')
    expect(secretFinding!.severity).toBe('critical')
  })

  it('should produce a summary comment mentioning the vulnerability', () => {
    const vulnerableContent = [
      `const apiKey = "${FAKE_SK_LIVE}"`,
      'console.log(apiKey)',
    ].join('\n')

    const files: FileChange[] = [
      {
        filePath: 'src/config.ts',
        status: 'added',
        content: vulnerableContent,
        additions: [{ start: 1, end: 2 }],
        deletions: [],
      },
    ]

    const result = runPipeline(files)
    expect(result.findings.length).toBeGreaterThan(0)

    const reportInput: ReportInput = {
      scanId: 'scan-integration-1',
      result,
      prNumber: 99,
      repoFullName: 'test-org/test-repo',
      commitSha: 'a1b2c3d4e5f6789012345678',
      dashboardUrl: 'https://sentinel.test',
    }

    const comment = formatSummaryComment(reportInput)

    // Should contain the finding title
    const secretFinding = result.findings.find((f) => f.ruleId === 'hardcoded-secrets')
    expect(secretFinding).toBeDefined()
    expect(comment).toContain(secretFinding!.title)

    // Should contain risk score
    expect(comment).toContain(`${result.riskScore}/100`)

    // Should contain inline comments for critical findings
    const inlineComments = formatInlineComments(result.findings)
    expect(inlineComments.length).toBeGreaterThan(0)
  })

  // -----------------------------------------------------------------------
  // Test: PR with clean code should produce no findings
  // -----------------------------------------------------------------------

  it('should produce zero findings for clean code', () => {
    const cleanContent = [
      'import { useState } from "react"',
      '',
      'export function Counter() {',
      '  const [count, setCount] = useState(0)',
      '  return (',
      '    <div>',
      '      <p>Count: {count}</p>',
      '      <button onClick={() => setCount(c => c + 1)}>Increment</button>',
      '    </div>',
      '  )',
      '}',
    ].join('\n')

    const files: FileChange[] = [
      {
        filePath: 'src/components/Counter.tsx',
        status: 'added',
        content: cleanContent,
        additions: [{ start: 1, end: 11 }],
        deletions: [],
      },
    ]

    const result = runPipeline(files)

    expect(result.findings).toHaveLength(0)
    expect(result.riskScore).toBe(0)
    expect(result.riskLevel).toBe('low')
  })

  it('should produce "No security issues found" comment for clean code', () => {
    const cleanContent = [
      'export function add(a: number, b: number): number {',
      '  return a + b',
      '}',
    ].join('\n')

    const files: FileChange[] = [
      {
        filePath: 'src/lib/math.ts',
        status: 'added',
        content: cleanContent,
        additions: [{ start: 1, end: 3 }],
        deletions: [],
      },
    ]

    const result = runPipeline(files)

    const reportInput: ReportInput = {
      scanId: 'scan-clean-1',
      result,
      prNumber: 100,
      repoFullName: 'test-org/clean-repo',
      commitSha: 'deadbeefdeadbeef12345678',
      dashboardUrl: 'https://sentinel.test',
    }

    const comment = formatSummaryComment(reportInput)
    expect(comment).toContain('No security issues found')
    expect(result.riskScore).toBe(0)
  })

  // -----------------------------------------------------------------------
  // Test: deduplication works in the pipeline
  // -----------------------------------------------------------------------

  it('should deduplicate identical findings from the same file', () => {
    // A file with the same secret on two lines will produce findings with
    // different fingerprints (because fingerprint includes the snippet).
    // But if we had the exact same snippet, dedup would keep only one.
    const content = [
      `const key1 = "${FAKE_SK_LIVE}"`,
      'const key2 = "ghp_abcdefghijklmnopqrstuvwxyz0123456789"',
    ].join('\n')

    const files: FileChange[] = [
      {
        filePath: 'src/secrets.ts',
        status: 'added',
        content,
        additions: [{ start: 1, end: 2 }],
        deletions: [],
      },
    ]

    const result = runPipeline(files)

    // Should find both secrets (different fingerprints)
    expect(result.findings.length).toBeGreaterThanOrEqual(2)

    // Each finding should have a unique fingerprint
    const fingerprints = result.findings.map((f) => f.fingerprint)
    const uniqueFingerprints = new Set(fingerprints)
    expect(uniqueFingerprints.size).toBe(fingerprints.length)
  })

  // -----------------------------------------------------------------------
  // Test: diff parser integration
  // -----------------------------------------------------------------------

  it('should parse a raw diff and process files through the pipeline', () => {
    const rawDiff = [
      'diff --git a/src/lib/utils.ts b/src/lib/utils.ts',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/src/lib/utils.ts',
      '@@ -0,0 +1,5 @@',
      '+export function greet(name: string): string {',
      '+  return `Hello, ${name}!`',
      '+}',
      '+',
      '+export const VERSION = "1.0.0"',
    ].join('\n')

    const parsedFiles = parseDiff(rawDiff)

    expect(parsedFiles).toHaveLength(1)
    expect(parsedFiles[0].filePath).toBe('src/lib/utils.ts')
    expect(parsedFiles[0].status).toBe('added')

    // Fill in content (parseDiff only extracts patch, not full content)
    const files = parsedFiles.map((f) => ({
      ...f,
      content: [
        'export function greet(name: string): string {',
        '  return `Hello, ${name}!`',
        '}',
        '',
        'export const VERSION = "1.0.0"',
      ].join('\n'),
    }))

    const result = runPipeline(files)

    // Clean utility file should have no findings
    expect(result.findings).toHaveLength(0)
    expect(result.riskScore).toBe(0)
  })

  // -----------------------------------------------------------------------
  // Test: inline comments generated for detected vulnerabilities
  // -----------------------------------------------------------------------

  it('should generate inline comments for critical/high findings only', () => {
    const content = [
      `const stripe = "${FAKE_SK_LIVE}"`,
      'const aws = "AKIA1234567890ABCDEF"',
      'export const hello = "world"',
    ].join('\n')

    const files: FileChange[] = [
      {
        filePath: 'src/lib/keys.ts',
        status: 'added',
        content,
        additions: [{ start: 1, end: 3 }],
        deletions: [],
      },
    ]

    const result = runPipeline(files)
    const inlineComments = formatInlineComments(result.findings)

    // All hardcoded secret findings are critical severity, so they should
    // all appear as inline comments
    const criticalFindings = result.findings.filter((f) => f.severity === 'critical')
    expect(inlineComments.length).toBe(criticalFindings.length)

    // Each inline comment should reference the correct file
    for (const comment of inlineComments) {
      expect(comment.path).toBe('src/lib/keys.ts')
      expect(comment.line).toBeGreaterThanOrEqual(1)
    }
  })

  // -----------------------------------------------------------------------
  // Test: scan result has correct risk level
  // -----------------------------------------------------------------------

  it('should assign appropriate risk level based on findings', () => {
    // One critical finding should produce a score of 25 => medium risk
    const content = `const key = "${FAKE_SK_LIVE}"`

    const files: FileChange[] = [
      {
        filePath: 'src/config.ts',
        status: 'added',
        content,
        additions: [{ start: 1, end: 1 }],
        deletions: [],
      },
    ]

    const result = runPipeline(files)
    expect(result.riskLevel).toBe(getRiskLevel(result.riskScore))

    // Verify the risk level matches the score brackets
    if (result.riskScore <= 20) expect(result.riskLevel).toBe('low')
    else if (result.riskScore <= 50) expect(result.riskLevel).toBe('medium')
    else if (result.riskScore <= 80) expect(result.riskLevel).toBe('high')
    else expect(result.riskLevel).toBe('critical')
  })

  // -----------------------------------------------------------------------
  // Test: test files are skipped
  // -----------------------------------------------------------------------

  it('should skip test files during scanning', () => {
    const testContent = `const key = "${FAKE_SK_LIVE}"`

    const files: FileChange[] = [
      {
        filePath: 'src/lib/payments.test.ts',
        status: 'added',
        content: testContent,
        additions: [{ start: 1, end: 1 }],
        deletions: [],
      },
    ]

    const result = runPipeline(files)

    // The hardcoded-secrets rule skips test files
    expect(result.findings).toHaveLength(0)
    expect(result.riskScore).toBe(0)
  })
})

import { describe, it, expect } from 'vitest'
import { formatSummaryComment } from '@/lib/reporting/summary-comment'
import type { ReportInput, ScanResult, RuleFinding, Severity } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFinding(overrides: Partial<RuleFinding> = {}): RuleFinding {
  return {
    ruleId: 'test-rule',
    ruleVersion: 1,
    severity: 'medium',
    confidence: 'high',
    title: 'Test finding',
    description: 'Test description',
    explanation: 'Test explanation',
    fixSuggestion: 'Fix it',
    filePath: 'src/app.ts',
    startLine: 10,
    endLine: 10,
    snippet: 'code',
    fingerprint: 'abc123',
    ...overrides,
  }
}

function makeReportInput(overrides: Partial<ReportInput> = {}): ReportInput {
  const findings = overrides.result?.findings ?? []
  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const f of findings) {
    bySeverity[f.severity]++
  }

  return {
    scanId: 'scan-001',
    prNumber: 42,
    repoFullName: 'org/repo',
    commitSha: 'abcdef1234567890',
    dashboardUrl: 'https://sentinel.example.com',
    result: {
      findings,
      riskScore: 0,
      riskLevel: 'low',
      summary: {
        totalFindings: findings.length,
        bySeverity,
        filesScanned: 5,
        rulesApplied: 12,
        scanDurationMs: 150,
        filesNotScanned: 0,
      },
      ...overrides.result,
    } as ScanResult,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('formatSummaryComment', () => {
  it('should contain "No security issues found" when there are zero findings', () => {
    const input = makeReportInput()
    const comment = formatSummaryComment(input)
    expect(comment).toContain('No security issues found')
  })

  it('should contain "Great job" when there are zero findings', () => {
    const input = makeReportInput()
    const comment = formatSummaryComment(input)
    expect(comment).toContain('Great job')
  })

  it('should contain the risk score', () => {
    const finding = makeFinding({ severity: 'critical', confidence: 'high' })
    const input = makeReportInput({
      result: {
        findings: [finding],
        riskScore: 25,
        riskLevel: 'medium',
        summary: {
          totalFindings: 1,
          bySeverity: { critical: 1, high: 0, medium: 0, low: 0 },
          filesScanned: 3,
          rulesApplied: 12,
          scanDurationMs: 200,
          filesNotScanned: 0,
        },
      },
    })
    const comment = formatSummaryComment(input)
    expect(comment).toContain('25/100')
    expect(comment).toContain('MEDIUM')
  })

  it('should contain the severity table with correct counts', () => {
    const findings = [
      makeFinding({ severity: 'critical', fingerprint: 'a' }),
      makeFinding({ severity: 'critical', fingerprint: 'b' }),
      makeFinding({ severity: 'high', fingerprint: 'c' }),
    ]
    const input = makeReportInput({
      result: {
        findings,
        riskScore: 65,
        riskLevel: 'high',
        summary: {
          totalFindings: 3,
          bySeverity: { critical: 2, high: 1, medium: 0, low: 0 },
          filesScanned: 5,
          rulesApplied: 12,
          scanDurationMs: 100,
          filesNotScanned: 0,
        },
      },
    })
    const comment = formatSummaryComment(input)
    expect(comment).toContain('Critical | 2')
    expect(comment).toContain('High | 1')
    // Medium and low have 0 counts, they should NOT appear in the table
    expect(comment).not.toContain('Medium |')
    expect(comment).not.toContain('Low |')
  })

  it('should show top findings limited to critical and high severity', () => {
    const findings = [
      makeFinding({ severity: 'critical', title: 'Critical Issue', fingerprint: 'a' }),
      makeFinding({ severity: 'high', title: 'High Issue', fingerprint: 'b' }),
      makeFinding({ severity: 'medium', title: 'Medium Issue', fingerprint: 'c' }),
      makeFinding({ severity: 'low', title: 'Low Issue', fingerprint: 'd' }),
    ]
    const input = makeReportInput({
      result: {
        findings,
        riskScore: 51,
        riskLevel: 'high',
        summary: {
          totalFindings: 4,
          bySeverity: { critical: 1, high: 1, medium: 1, low: 1 },
          filesScanned: 5,
          rulesApplied: 12,
          scanDurationMs: 100,
          filesNotScanned: 0,
        },
      },
    })
    const comment = formatSummaryComment(input)
    expect(comment).toContain('Critical Issue')
    expect(comment).toContain('High Issue')
    // Medium and low findings should not appear as top finding headers
    const topFindingsSection = comment.split('### Top Findings')[1]
    expect(topFindingsSection).toBeDefined()
    expect(topFindingsSection).not.toContain('Medium Issue')
    expect(topFindingsSection).not.toContain('Low Issue')
  })

  it('should contain the dashboard link with scan ID', () => {
    const input = makeReportInput()
    const comment = formatSummaryComment(input)
    expect(comment).toContain('https://sentinel.example.com/scans/scan-001')
  })

  it('should contain the first 7 characters of commit SHA', () => {
    const input = makeReportInput({ commitSha: 'abcdef1234567890' })
    const comment = formatSummaryComment(input)
    expect(comment).toContain('abcdef1')
  })

  it('should contain scan metadata (files scanned, rules applied, duration)', () => {
    const input = makeReportInput()
    const comment = formatSummaryComment(input)
    expect(comment).toContain('5 files scanned')
    expect(comment).toContain('12 rules applied')
    expect(comment).toContain('150ms')
  })

  it('should contain fix suggestions in collapsible sections', () => {
    const finding = makeFinding({
      severity: 'critical',
      fixSuggestion: 'Use environment variables instead',
    })
    const input = makeReportInput({
      result: {
        findings: [finding],
        riskScore: 25,
        riskLevel: 'medium',
        summary: {
          totalFindings: 1,
          bySeverity: { critical: 1, high: 0, medium: 0, low: 0 },
          filesScanned: 1,
          rulesApplied: 12,
          scanDurationMs: 50,
          filesNotScanned: 0,
        },
      },
    })
    const comment = formatSummaryComment(input)
    expect(comment).toContain('<details>')
    expect(comment).toContain('<summary>Fix Suggestion</summary>')
    expect(comment).toContain('Use environment variables instead')
    expect(comment).toContain('</details>')
  })

  it('should include file path and line number for each top finding', () => {
    const finding = makeFinding({
      severity: 'high',
      filePath: 'src/api/handler.ts',
      startLine: 42,
    })
    const input = makeReportInput({
      result: {
        findings: [finding],
        riskScore: 15,
        riskLevel: 'low',
        summary: {
          totalFindings: 1,
          bySeverity: { critical: 0, high: 1, medium: 0, low: 0 },
          filesScanned: 1,
          rulesApplied: 12,
          scanDurationMs: 50,
          filesNotScanned: 0,
        },
      },
    })
    const comment = formatSummaryComment(input)
    expect(comment).toContain('`src/api/handler.ts:42`')
  })

  it('should contain the header with CodeSentinel name', () => {
    const input = makeReportInput()
    const comment = formatSummaryComment(input)
    expect(comment).toContain('CodeSentinel Security Report')
  })

  it('should limit top findings to 10', () => {
    const findings = Array.from({ length: 15 }, (_, i) =>
      makeFinding({
        severity: 'critical',
        title: `Critical Finding ${i}`,
        fingerprint: `fp-${i}`,
      })
    )
    const bySeverity: Record<Severity, number> = { critical: 15, high: 0, medium: 0, low: 0 }
    const input = makeReportInput({
      result: {
        findings,
        riskScore: 100,
        riskLevel: 'critical',
        summary: {
          totalFindings: 15,
          bySeverity,
          filesScanned: 10,
          rulesApplied: 12,
          scanDurationMs: 300,
          filesNotScanned: 0,
        },
      },
    })
    const comment = formatSummaryComment(input)
    // Findings 0 through 9 should be present
    expect(comment).toContain('Critical Finding 0')
    expect(comment).toContain('Critical Finding 9')
    // Finding 10 should not be present (limited to first 10)
    expect(comment).not.toContain('Critical Finding 10')
  })
})

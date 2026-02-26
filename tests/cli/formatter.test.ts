import { describe, it, expect } from 'vitest'
import { formatTerminal, formatJson, formatFailMessage, formatPassMessage } from '@/cli/formatter'
import type { ScanResult, RuleFinding } from '@/types'

// Assembled at runtime to avoid GitHub push protection false positive
const FAKE_SK_LIVE = `sk_live_${'TESTKEY00000000000000000000'}`

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    findings: [],
    riskScore: 0,
    riskLevel: 'low',
    summary: {
      totalFindings: 0,
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      filesScanned: 5,
      rulesApplied: 12,
      scanDurationMs: 42,
    },
    ...overrides,
  }
}

function makeFinding(overrides: Partial<RuleFinding> = {}): RuleFinding {
  return {
    ruleId: 'hardcoded-secrets',
    ruleVersion: 1,
    severity: 'critical',
    confidence: 'high',
    title: 'Stripe live secret key detected',
    description: 'A hardcoded Stripe live key was found.',
    explanation: 'Hardcoded secrets can be extracted from source code.',
    fixSuggestion: 'Move the key to an environment variable.',
    filePath: 'src/lib/api-client.ts',
    startLine: 10,
    endLine: 10,
    snippet: `const key = "${FAKE_SK_LIVE}"`,
    fingerprint: 'abc123',
    ...overrides,
  }
}

describe('formatTerminal', () => {
  it('should show clean scan message when there are no findings', () => {
    const result = makeScanResult()
    const output = formatTerminal(result, '/tmp/project', '0.1.0')

    expect(output).toContain('No findings')
    expect(output).toContain('clean scan')
  })

  it('should include version and directory in the header', () => {
    const result = makeScanResult()
    const output = formatTerminal(result, '/tmp/myproject', '0.1.0')

    expect(output).toContain('v0.1.0')
    expect(output).toContain('/tmp/myproject')
  })

  it('should show files scanned and rules applied counts', () => {
    const result = makeScanResult()
    const output = formatTerminal(result, '/tmp/project', '0.1.0')

    expect(output).toContain('5 files scanned')
    expect(output).toContain('12 rules applied')
  })

  it('should display severity labels and finding details when findings exist', () => {
    const finding = makeFinding()
    const result = makeScanResult({
      findings: [finding],
      riskScore: 30,
      riskLevel: 'medium',
      summary: {
        totalFindings: 1,
        bySeverity: { critical: 1, high: 0, medium: 0, low: 0 },
        filesScanned: 5,
        rulesApplied: 12,
        scanDurationMs: 42,
      },
    })
    const output = formatTerminal(result, '/tmp/project', '0.1.0')

    expect(output).toContain('CRITICAL')
    expect(output).toContain('Stripe live secret key detected')
    expect(output).toContain('src/lib/api-client.ts:10')
    expect(output).toContain('Move the key to an environment variable')
  })

  it('should show risk score and risk level', () => {
    const finding = makeFinding()
    const result = makeScanResult({
      findings: [finding],
      riskScore: 30,
      riskLevel: 'medium',
      summary: {
        totalFindings: 1,
        bySeverity: { critical: 1, high: 0, medium: 0, low: 0 },
        filesScanned: 5,
        rulesApplied: 12,
        scanDurationMs: 42,
      },
    })
    const output = formatTerminal(result, '/tmp/project', '0.1.0')

    expect(output).toContain('30/100')
    expect(output).toContain('MEDIUM')
  })

  it('should sort findings by severity with critical first', () => {
    const criticalFinding = makeFinding({ severity: 'critical', title: 'Critical issue' })
    const mediumFinding = makeFinding({ severity: 'medium', title: 'Medium issue', fingerprint: 'def456' })
    const highFinding = makeFinding({ severity: 'high', title: 'High issue', fingerprint: 'ghi789' })

    const result = makeScanResult({
      findings: [mediumFinding, criticalFinding, highFinding],
      riskScore: 50,
      riskLevel: 'high',
      summary: {
        totalFindings: 3,
        bySeverity: { critical: 1, high: 1, medium: 1, low: 0 },
        filesScanned: 5,
        rulesApplied: 12,
        scanDurationMs: 42,
      },
    })
    const output = formatTerminal(result, '/tmp/project', '0.1.0')

    // Strip ANSI codes for position comparison
    const stripped = output.replace(/\x1b\[[0-9;]*m/g, '')
    const criticalPos = stripped.indexOf('Critical issue')
    const highPos = stripped.indexOf('High issue')
    const mediumPos = stripped.indexOf('Medium issue')

    expect(criticalPos).toBeLessThan(highPos)
    expect(highPos).toBeLessThan(mediumPos)
  })

  it('should show severity breakdown in the summary box', () => {
    const result = makeScanResult({
      findings: [makeFinding()],
      riskScore: 30,
      riskLevel: 'medium',
      summary: {
        totalFindings: 3,
        bySeverity: { critical: 1, high: 1, medium: 1, low: 0 },
        filesScanned: 5,
        rulesApplied: 12,
        scanDurationMs: 42,
      },
    })
    const output = formatTerminal(result, '/tmp/project', '0.1.0')

    expect(output).toContain('1 critical')
    expect(output).toContain('1 high')
    expect(output).toContain('1 medium')
  })
})

describe('formatJson', () => {
  it('should return valid JSON', () => {
    const result = makeScanResult()
    const output = formatJson(result)

    expect(() => JSON.parse(output)).not.toThrow()
  })

  it('should contain all top-level fields', () => {
    const result = makeScanResult({
      findings: [makeFinding()],
      riskScore: 25,
      riskLevel: 'medium',
    })
    const output = formatJson(result)
    const parsed = JSON.parse(output)

    expect(parsed).toHaveProperty('findings')
    expect(parsed).toHaveProperty('riskScore')
    expect(parsed).toHaveProperty('riskLevel')
    expect(parsed).toHaveProperty('summary')
  })

  it('should preserve finding details in the output', () => {
    const finding = makeFinding()
    const result = makeScanResult({ findings: [finding] })
    const output = formatJson(result)
    const parsed = JSON.parse(output)

    expect(parsed.findings).toHaveLength(1)
    expect(parsed.findings[0].ruleId).toBe('hardcoded-secrets')
    expect(parsed.findings[0].severity).toBe('critical')
    expect(parsed.findings[0].filePath).toBe('src/lib/api-client.ts')
  })

  it('should produce pretty-printed JSON with indentation', () => {
    const result = makeScanResult()
    const output = formatJson(result)

    // Pretty-printed JSON has newlines and indentation
    expect(output).toContain('\n')
    expect(output).toContain('  ')
  })
})

describe('formatFailMessage', () => {
  it('should include the count of findings', () => {
    const output = formatFailMessage(3, 'high')

    const stripped = output.replace(/\x1b\[[0-9;]*m/g, '')
    expect(stripped).toContain('3')
  })

  it('should include the severity threshold', () => {
    const output = formatFailMessage(1, 'critical')

    const stripped = output.replace(/\x1b\[[0-9;]*m/g, '')
    expect(stripped).toContain('critical')
  })

  it('should indicate failure', () => {
    const output = formatFailMessage(2, 'high')

    const stripped = output.replace(/\x1b\[[0-9;]*m/g, '')
    expect(stripped.toLowerCase()).toContain('failed')
  })
})

describe('formatPassMessage', () => {
  it('should indicate success', () => {
    const output = formatPassMessage()

    const stripped = output.replace(/\x1b\[[0-9;]*m/g, '')
    expect(stripped.toLowerCase()).toContain('passed')
  })

  it('should mention no blocking findings', () => {
    const output = formatPassMessage()

    const stripped = output.replace(/\x1b\[[0-9;]*m/g, '')
    expect(stripped.toLowerCase()).toContain('no blocking findings')
  })
})

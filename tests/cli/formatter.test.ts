import { describe, it, expect } from 'vitest'
import {
  formatTerminal,
  formatJson,
  formatFailMessage,
  formatPassMessage,
  formatIncompleteMessage,
} from '@/cli/formatter'
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
      filesNotScanned: 0,
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
        filesNotScanned: 0,
      },
    })
    const output = formatTerminal(result, '/tmp/project', '0.1.0')

    expect(output).toContain('CRITICAL')
    expect(output).toContain('Stripe live secret key detected')
    expect(output).toContain('src/lib/api-client.ts:10')
    expect(output).toContain('Move the key to an environment variable')
  })

  it('should separate the severity label from the title even for CRITICAL', () => {
    const result = makeScanResult({
      findings: [makeFinding({ severity: 'critical', title: 'Critical issue' })],
      riskScore: 25,
      riskLevel: 'medium',
    })
    const stripped = formatTerminal(result, '/tmp/project', '0.1.0').replace(/\x1b\[[0-9;]*m/g, '')

    expect(stripped).toMatch(/CRITICAL {2,}Critical issue/)
  })

  it('should name the rule that caught each finding next to its location', () => {
    const result = makeScanResult({
      findings: [makeFinding({ ruleId: 'next-public-secret', filePath: '.env.local', startLine: 4 })],
      riskScore: 25,
      riskLevel: 'medium',
    })
    const stripped = formatTerminal(result, '/tmp/project', '0.1.0').replace(/\x1b\[[0-9;]*m/g, '')

    expect(stripped).toContain('.env.local:4  next-public-secret')
  })

  it('should wrap long fix suggestions to 80 columns and keep every word', () => {
    const fixSuggestion = 'Never use the Supabase service role key in client-side code. Use the anon key for client-side and service role key only in server-side API routes.'
    const result = makeScanResult({
      findings: [makeFinding({ fixSuggestion })],
      riskScore: 25,
      riskLevel: 'medium',
    })
    const stripped = formatTerminal(result, '/tmp/project', '0.1.0').replace(/\x1b\[[0-9;]*m/g, '')
    const fixLines = stripped.split('\n').filter(line => line.startsWith('            ') && !line.includes(':10'))

    expect(fixLines.length).toBeGreaterThan(1)
    for (const line of fixLines) expect(line.length).toBeLessThanOrEqual(80)
    expect(fixLines.map(line => line.replace('\u2192', '').trim()).join(' ')).toBe(fixSuggestion)
  })

  it('should use the singular for a single finding and the plural otherwise', () => {
    const one = makeScanResult({
      findings: [makeFinding()],
      riskScore: 25,
      riskLevel: 'medium',
      summary: { ...makeScanResult().summary, totalFindings: 1, bySeverity: { critical: 1, high: 0, medium: 0, low: 0 } },
    })
    const two = makeScanResult({
      findings: [makeFinding(), makeFinding({ fingerprint: 'other' })],
      riskScore: 50,
      riskLevel: 'high',
      summary: { ...makeScanResult().summary, totalFindings: 2, bySeverity: { critical: 2, high: 0, medium: 0, low: 0 } },
    })

    expect(formatTerminal(one, '.', '0.1.0')).toContain('1 finding\x1b')
    expect(formatTerminal(two, '.', '0.1.0')).toContain('2 findings\x1b')
  })

  it('should warn, right under the file count, when the scan did not reach every file', () => {
    const result = makeScanResult({
      summary: { ...makeScanResult().summary, filesScanned: 18, filesNotScanned: 7 },
    })
    const stripped = formatTerminal(result, '.', '0.1.0').replace(/\x1b\[[0-9;]*m/g, '')

    expect(stripped).toContain('18 files scanned')
    expect(stripped).toContain('! Time limit reached: 7 files were not scanned')
  })

  it('should use the singular when a single file was not reached', () => {
    const result = makeScanResult({
      summary: { ...makeScanResult().summary, filesNotScanned: 1 },
    })
    const stripped = formatTerminal(result, '.', '0.1.0').replace(/\x1b\[[0-9;]*m/g, '')

    expect(stripped).toContain('! Time limit reached: 1 file was not scanned')
  })

  it('should not call a scan clean when it did not reach every file', () => {
    const result = makeScanResult({
      summary: { ...makeScanResult().summary, filesScanned: 0, filesNotScanned: 3 },
    })
    const stripped = formatTerminal(result, '.', '0.1.0').replace(/\x1b\[[0-9;]*m/g, '')

    expect(stripped).toContain('No findings in the files scanned')
    expect(stripped).not.toContain('clean scan')
  })

  it('should not warn when every file was scanned', () => {
    const stripped = formatTerminal(makeScanResult(), '.', '0.1.0').replace(/\x1b\[[0-9;]*m/g, '')

    expect(stripped).not.toContain('Time limit')
  })

  it('should not contain em dashes', () => {
    const result = makeScanResult({ findings: [makeFinding()], riskScore: 25, riskLevel: 'medium' })

    expect(formatTerminal(result, '/tmp/project', '0.1.0')).not.toContain('\u2014')
    expect(formatTerminal(makeScanResult(), '/tmp/project', '0.1.0')).not.toContain('\u2014')
    expect(formatFailMessage(2, 'high')).not.toContain('\u2014')
    expect(formatPassMessage(2)).not.toContain('\u2014')
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
        filesNotScanned: 0,
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
        filesNotScanned: 0,
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
        filesNotScanned: 0,
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
  it('should use the singular for one finding', () => {
    const stripped = formatFailMessage(1, 'high').replace(/\x1b\[[0-9;]*m/g, '')

    expect(stripped).toBe('\u2716 Scan failed: 1 blocking finding at high or above')
  })

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

  it('should stay a single line when nothing was reported', () => {
    expect(formatPassMessage(0)).not.toContain('\n')
  })

  it('should explain why reported findings did not block', () => {
    const stripped = formatPassMessage(2).replace(/\x1b\[[0-9;]*m/g, '')

    expect(stripped).toContain('(2 reported)')
    expect(stripped).toContain('high confidence')
  })
})

describe('formatIncompleteMessage', () => {
  it('says the scan is incomplete, not a pass, and how to raise the limit', () => {
    const stripped = formatIncompleteMessage().replace(/\x1b\[[0-9;]*m/g, '')

    expect(stripped).toContain('Scan incomplete, not a pass')
    expect(stripped).toContain('CODESENTINEL_SCAN_TIMEOUT_MS')
    expect(stripped).not.toContain('passed')
    expect(stripped).not.toContain('\u2014')
  })
})

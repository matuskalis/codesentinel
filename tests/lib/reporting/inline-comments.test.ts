import { describe, it, expect } from 'vitest'
import { formatInlineComments } from '@/lib/reporting/inline-comments'
import type { RuleFinding } from '@/types'

// ---------------------------------------------------------------------------
// Helper
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

// ---------------------------------------------------------------------------
// formatInlineComments
// ---------------------------------------------------------------------------

describe('formatInlineComments', () => {
  it('should return empty array for empty findings', () => {
    expect(formatInlineComments([])).toEqual([])
  })

  it('should include critical findings', () => {
    const findings = [makeFinding({ severity: 'critical' })]
    const comments = formatInlineComments(findings)
    expect(comments).toHaveLength(1)
  })

  it('should include high findings', () => {
    const findings = [makeFinding({ severity: 'high' })]
    const comments = formatInlineComments(findings)
    expect(comments).toHaveLength(1)
  })

  it('should exclude medium findings', () => {
    const findings = [makeFinding({ severity: 'medium' })]
    const comments = formatInlineComments(findings)
    expect(comments).toHaveLength(0)
  })

  it('should exclude low findings', () => {
    const findings = [makeFinding({ severity: 'low' })]
    const comments = formatInlineComments(findings)
    expect(comments).toHaveLength(0)
  })

  it('should return only critical and high from mixed findings', () => {
    const findings = [
      makeFinding({ severity: 'critical', fingerprint: 'a' }),
      makeFinding({ severity: 'high', fingerprint: 'b' }),
      makeFinding({ severity: 'medium', fingerprint: 'c' }),
      makeFinding({ severity: 'low', fingerprint: 'd' }),
    ]
    const comments = formatInlineComments(findings)
    expect(comments).toHaveLength(2)
  })

  it('should limit to 20 comments maximum', () => {
    const findings = Array.from({ length: 25 }, (_, i) =>
      makeFinding({ severity: 'critical', fingerprint: `fp-${i}` })
    )
    const comments = formatInlineComments(findings)
    expect(comments).toHaveLength(20)
  })

  it('should set the correct path from finding filePath', () => {
    const findings = [makeFinding({ severity: 'critical', filePath: 'src/api/route.ts' })]
    const comments = formatInlineComments(findings)
    expect(comments[0].path).toBe('src/api/route.ts')
  })

  it('should set the correct line from finding startLine', () => {
    const findings = [makeFinding({ severity: 'high', startLine: 42 })]
    const comments = formatInlineComments(findings)
    expect(comments[0].line).toBe(42)
  })

  it('should include severity in the comment body', () => {
    const findings = [makeFinding({ severity: 'critical' })]
    const comments = formatInlineComments(findings)
    expect(comments[0].body).toContain('critical')
  })

  it('should include the finding title in the body', () => {
    const findings = [makeFinding({ severity: 'critical', title: 'SQL Injection Risk' })]
    const comments = formatInlineComments(findings)
    expect(comments[0].body).toContain('SQL Injection Risk')
  })

  it('should include the description in the body', () => {
    const findings = [
      makeFinding({ severity: 'critical', description: 'User input is not sanitized' }),
    ]
    const comments = formatInlineComments(findings)
    expect(comments[0].body).toContain('User input is not sanitized')
  })

  it('should include the fix suggestion in the body', () => {
    const findings = [
      makeFinding({ severity: 'high', fixSuggestion: 'Use parameterized queries' }),
    ]
    const comments = formatInlineComments(findings)
    expect(comments[0].body).toContain('Use parameterized queries')
  })

  it('should include a severity emoji in the body', () => {
    const criticalFindings = [makeFinding({ severity: 'critical', fingerprint: 'a' })]
    const highFindings = [makeFinding({ severity: 'high', fingerprint: 'b' })]

    const criticalComments = formatInlineComments(criticalFindings)
    const highComments = formatInlineComments(highFindings)

    // Critical uses red circle, high uses orange circle
    expect(criticalComments[0].body).toContain('\u{1F534}')
    expect(highComments[0].body).toContain('\u{1F7E0}')
  })

  it('should preserve order from input when all are eligible', () => {
    const findings = [
      makeFinding({ severity: 'critical', title: 'First', filePath: 'a.ts', fingerprint: 'a' }),
      makeFinding({ severity: 'high', title: 'Second', filePath: 'b.ts', fingerprint: 'b' }),
      makeFinding({ severity: 'critical', title: 'Third', filePath: 'c.ts', fingerprint: 'c' }),
    ]
    const comments = formatInlineComments(findings)
    expect(comments[0].body).toContain('First')
    expect(comments[1].body).toContain('Second')
    expect(comments[2].body).toContain('Third')
  })
})

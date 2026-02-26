import { describe, it, expect } from 'vitest'
import { calculateRiskScore, getRiskLevel } from '@/lib/scoring'
import type { RuleFinding, Severity, Confidence } from '@/types'

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
    filePath: 'test.ts',
    startLine: 1,
    endLine: 1,
    snippet: 'code',
    fingerprint: 'abc123',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// calculateRiskScore
// ---------------------------------------------------------------------------

describe('calculateRiskScore', () => {
  it('should return 0 for empty findings array', () => {
    expect(calculateRiskScore([])).toBe(0)
  })

  it('should score a single critical/high-confidence finding as 25', () => {
    // critical=25 * high=1.0 => 25
    const findings = [makeFinding({ severity: 'critical', confidence: 'high' })]
    expect(calculateRiskScore(findings)).toBe(25)
  })

  it('should score a single high/high-confidence finding as 15', () => {
    // high=15 * high=1.0 => 15
    const findings = [makeFinding({ severity: 'high', confidence: 'high' })]
    expect(calculateRiskScore(findings)).toBe(15)
  })

  it('should score a single medium/high-confidence finding as 8', () => {
    // medium=8 * high=1.0 => 8
    const findings = [makeFinding({ severity: 'medium', confidence: 'high' })]
    expect(calculateRiskScore(findings)).toBe(8)
  })

  it('should score a single low/high-confidence finding as 3', () => {
    // low=3 * high=1.0 => 3
    const findings = [makeFinding({ severity: 'low', confidence: 'high' })]
    expect(calculateRiskScore(findings)).toBe(3)
  })

  it('should apply confidence weight of 1.0 for high confidence', () => {
    // critical=25 * high=1.0 => 25
    const findings = [makeFinding({ severity: 'critical', confidence: 'high' })]
    expect(calculateRiskScore(findings)).toBe(25)
  })

  it('should apply confidence weight of 0.6 for medium confidence', () => {
    // critical=25 * medium=0.6 => 15
    const findings = [makeFinding({ severity: 'critical', confidence: 'medium' })]
    expect(calculateRiskScore(findings)).toBe(15)
  })

  it('should apply confidence weight of 0.3 for low confidence', () => {
    // critical=25 * low=0.3 => 7.5, rounded to 8
    const findings = [makeFinding({ severity: 'critical', confidence: 'low' })]
    expect(calculateRiskScore(findings)).toBe(8)
  })

  it('should sum scores from multiple findings', () => {
    // critical/high = 25, high/high = 15  =>  40
    const findings = [
      makeFinding({ severity: 'critical', confidence: 'high', fingerprint: 'a' }),
      makeFinding({ severity: 'high', confidence: 'high', fingerprint: 'b' }),
    ]
    expect(calculateRiskScore(findings)).toBe(40)
  })

  it('should cap the score at 100', () => {
    // 5 critical findings at high confidence: 5 * 25 = 125 => capped at 100
    const findings = Array.from({ length: 5 }, (_, i) =>
      makeFinding({ severity: 'critical', confidence: 'high', fingerprint: `f${i}` })
    )
    expect(calculateRiskScore(findings)).toBe(100)
  })

  it('should round the final score', () => {
    // medium=8 * low=0.3 = 2.4 => rounded to 2
    const findings = [makeFinding({ severity: 'medium', confidence: 'low' })]
    expect(calculateRiskScore(findings)).toBe(2)
  })

  it('should handle many low-severity low-confidence findings', () => {
    // low=3 * low=0.3 = 0.9 each; 10 findings => 9, rounded
    const findings = Array.from({ length: 10 }, (_, i) =>
      makeFinding({ severity: 'low', confidence: 'low', fingerprint: `f${i}` })
    )
    expect(calculateRiskScore(findings)).toBe(9)
  })

  it('should handle mixed severity and confidence', () => {
    // critical/high = 25, high/medium = 9, low/low = 0.9 => total 34.9 => 35
    const findings = [
      makeFinding({ severity: 'critical', confidence: 'high', fingerprint: 'a' }),
      makeFinding({ severity: 'high', confidence: 'medium', fingerprint: 'b' }),
      makeFinding({ severity: 'low', confidence: 'low', fingerprint: 'c' }),
    ]
    expect(calculateRiskScore(findings)).toBe(35)
  })
})

// ---------------------------------------------------------------------------
// getRiskLevel
// ---------------------------------------------------------------------------

describe('getRiskLevel', () => {
  it('should return "low" for score 0', () => {
    expect(getRiskLevel(0)).toBe('low')
  })

  it('should return "low" for score 20 (upper boundary)', () => {
    expect(getRiskLevel(20)).toBe('low')
  })

  it('should return "medium" for score 21 (lower boundary)', () => {
    expect(getRiskLevel(21)).toBe('medium')
  })

  it('should return "medium" for score 50 (upper boundary)', () => {
    expect(getRiskLevel(50)).toBe('medium')
  })

  it('should return "high" for score 51 (lower boundary)', () => {
    expect(getRiskLevel(51)).toBe('high')
  })

  it('should return "high" for score 80 (upper boundary)', () => {
    expect(getRiskLevel(80)).toBe('high')
  })

  it('should return "critical" for score 81 (lower boundary)', () => {
    expect(getRiskLevel(81)).toBe('critical')
  })

  it('should return "critical" for score 100', () => {
    expect(getRiskLevel(100)).toBe('critical')
  })

  it('should return "low" for score 1', () => {
    expect(getRiskLevel(1)).toBe('low')
  })

  it('should return "medium" for score 35', () => {
    expect(getRiskLevel(35)).toBe('medium')
  })

  it('should return "high" for score 65', () => {
    expect(getRiskLevel(65)).toBe('high')
  })

  it('should return "critical" for score 95', () => {
    expect(getRiskLevel(95)).toBe('critical')
  })
})

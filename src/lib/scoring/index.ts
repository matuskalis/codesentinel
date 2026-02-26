import type { RuleFinding, Severity, Confidence, RiskLevel } from '@/types'

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
}

const CONFIDENCE_WEIGHTS: Record<Confidence, number> = {
  high: 1.0,
  medium: 0.6,
  low: 0.3,
}

export function calculateRiskScore(findings: RuleFinding[]): number {
  if (findings.length === 0) return 0

  let rawScore = 0
  for (const finding of findings) {
    rawScore += SEVERITY_WEIGHTS[finding.severity] * CONFIDENCE_WEIGHTS[finding.confidence]
  }

  return Math.min(100, Math.round(rawScore))
}

export function getRiskLevel(score: number): RiskLevel {
  if (score >= 81) return 'critical'
  if (score >= 51) return 'high'
  if (score >= 21) return 'medium'
  return 'low'
}

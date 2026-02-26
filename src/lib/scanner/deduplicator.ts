import type { RuleFinding, Severity } from '@/types'

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

export function deduplicateFindings(findings: RuleFinding[]): RuleFinding[] {
  const byFingerprint = new Map<string, RuleFinding>()

  for (const finding of findings) {
    const existing = byFingerprint.get(finding.fingerprint)
    if (!existing || SEVERITY_ORDER[finding.severity] > SEVERITY_ORDER[existing.severity]) {
      byFingerprint.set(finding.fingerprint, finding)
    }
  }

  return Array.from(byFingerprint.values())
}

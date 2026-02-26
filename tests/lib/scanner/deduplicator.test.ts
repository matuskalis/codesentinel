import { describe, it, expect } from 'vitest'
import { deduplicateFindings } from '@/lib/scanner/deduplicator'
import type { RuleFinding } from '@/types'

function makeFinding(overrides: Partial<RuleFinding> = {}): RuleFinding {
  return {
    ruleId: 'test-rule',
    ruleVersion: 1,
    severity: 'high',
    confidence: 'high',
    title: 'Test finding',
    description: 'Test description',
    explanation: 'Test explanation',
    fixSuggestion: 'Test fix',
    filePath: 'src/file.ts',
    startLine: 1,
    endLine: 1,
    snippet: 'const x = 1',
    fingerprint: 'abc123',
    ...overrides,
  }
}

describe('deduplicateFindings', () => {
  describe('duplicate fingerprints', () => {
    it('should keep only one finding when duplicates have the same fingerprint', () => {
      const findings = [
        makeFinding({ fingerprint: 'same-fp' }),
        makeFinding({ fingerprint: 'same-fp' }),
        makeFinding({ fingerprint: 'same-fp' }),
      ]

      const result = deduplicateFindings(findings)
      expect(result.length).toBe(1)
    })

    it('should keep the higher severity finding when duplicates differ in severity', () => {
      const findings = [
        makeFinding({ fingerprint: 'same-fp', severity: 'low' }),
        makeFinding({ fingerprint: 'same-fp', severity: 'critical' }),
        makeFinding({ fingerprint: 'same-fp', severity: 'medium' }),
      ]

      const result = deduplicateFindings(findings)
      expect(result.length).toBe(1)
      expect(result[0].severity).toBe('critical')
    })

    it('should keep high over medium severity', () => {
      const findings = [
        makeFinding({ fingerprint: 'same-fp', severity: 'medium' }),
        makeFinding({ fingerprint: 'same-fp', severity: 'high' }),
      ]

      const result = deduplicateFindings(findings)
      expect(result.length).toBe(1)
      expect(result[0].severity).toBe('high')
    })

    it('should keep medium over low severity', () => {
      const findings = [
        makeFinding({ fingerprint: 'same-fp', severity: 'low' }),
        makeFinding({ fingerprint: 'same-fp', severity: 'medium' }),
      ]

      const result = deduplicateFindings(findings)
      expect(result.length).toBe(1)
      expect(result[0].severity).toBe('medium')
    })
  })

  describe('unique fingerprints', () => {
    it('should keep all findings with unique fingerprints', () => {
      const findings = [
        makeFinding({ fingerprint: 'fp-1' }),
        makeFinding({ fingerprint: 'fp-2' }),
        makeFinding({ fingerprint: 'fp-3' }),
      ]

      const result = deduplicateFindings(findings)
      expect(result.length).toBe(3)
    })
  })

  describe('mixed duplicates and unique', () => {
    it('should correctly deduplicate a mixed set', () => {
      const findings = [
        makeFinding({ fingerprint: 'fp-1', severity: 'low' }),
        makeFinding({ fingerprint: 'fp-1', severity: 'high' }),
        makeFinding({ fingerprint: 'fp-2', severity: 'medium' }),
        makeFinding({ fingerprint: 'fp-3', severity: 'critical' }),
        makeFinding({ fingerprint: 'fp-3', severity: 'low' }),
      ]

      const result = deduplicateFindings(findings)
      expect(result.length).toBe(3)

      const fp1 = result.find(f => f.fingerprint === 'fp-1')
      expect(fp1?.severity).toBe('high')

      const fp3 = result.find(f => f.fingerprint === 'fp-3')
      expect(fp3?.severity).toBe('critical')
    })
  })

  describe('edge cases', () => {
    it('should return empty array for empty input', () => {
      const result = deduplicateFindings([])
      expect(result.length).toBe(0)
    })

    it('should return single finding unchanged', () => {
      const finding = makeFinding({ fingerprint: 'only-one' })
      const result = deduplicateFindings([finding])
      expect(result.length).toBe(1)
      expect(result[0]).toEqual(finding)
    })

    it('should keep the first finding when severities are equal', () => {
      const first = makeFinding({ fingerprint: 'same-fp', severity: 'high', title: 'First' })
      const second = makeFinding({ fingerprint: 'same-fp', severity: 'high', title: 'Second' })

      const result = deduplicateFindings([first, second])
      expect(result.length).toBe(1)
      // Equal severity means the second does NOT replace the first (not strictly greater)
      expect(result[0].title).toBe('First')
    })
  })
})

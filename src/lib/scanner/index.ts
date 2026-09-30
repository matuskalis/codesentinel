import type { FileChange, RuleFinding, ScanResult, ScanLimits, Severity } from '@/types'
import { DEFAULT_SCAN_LIMITS, shouldSkipFile } from '@/lib/scan-limits'
import { classifyFile } from './file-classifier'
import { getRulesForFile } from '@/lib/rules'
import { deduplicateFindings } from './deduplicator'
import { calculateRiskScore, getRiskLevel } from '@/lib/scoring'
import { logger } from '@/lib/logger'

export async function runScan(
  files: FileChange[],
  mutedRuleIds: string[] = [],
  limits: ScanLimits = DEFAULT_SCAN_LIMITS
): Promise<ScanResult> {
  const startTime = Date.now()
  const allFindings: RuleFinding[] = []
  const mutedSet = new Set(mutedRuleIds)
  const rulesApplied = new Set<string>()
  let filesScanned = 0

  const filesToScan = files
    .filter(f => f.status !== 'deleted')
    .filter(f => !shouldSkipFile(f.filePath, limits))
    .filter(f => Buffer.byteLength(f.content, 'utf-8') <= limits.maxBytesPerFile)
    .slice(0, limits.maxFilesPerScan)

  for (const file of filesToScan) {
    if (Date.now() - startTime >= limits.scanTimeoutMs) {
      logger.warn({ filesScanned, totalFiles: filesToScan.length }, 'Scan timeout reached')
      break
    }

    const classification = classifyFile(file.filePath, file.content)
    const applicableRules = getRulesForFile(classification)
      .filter(rule => !mutedSet.has(rule.id))

    for (const rule of applicableRules) {
      rulesApplied.add(rule.id)
      try {
        const ruleStart = Date.now()
        const findings = rule.run(file, classification)
        const ruleTime = Date.now() - ruleStart

        if (ruleTime > limits.ruleTimeoutMs) {
          logger.warn({ ruleId: rule.id, ruleTime, filePath: file.filePath }, 'Rule execution exceeded timeout')
        }

        allFindings.push(...findings)
      } catch (error) {
        logger.error({ ruleId: rule.id, filePath: file.filePath, error }, 'Rule execution failed')
      }
    }

    filesScanned++
  }

  const dedupedFindings = deduplicateFindings(allFindings)
  const riskScore = calculateRiskScore(dedupedFindings)
  const riskLevel = getRiskLevel(riskScore)
  const scanDuration = Date.now() - startTime

  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const f of dedupedFindings) {
    bySeverity[f.severity]++
  }

  return {
    findings: dedupedFindings,
    riskScore,
    riskLevel,
    summary: {
      totalFindings: dedupedFindings.length,
      bySeverity,
      filesScanned,
      filesNotScanned: filesToScan.length - filesScanned,
      rulesApplied: rulesApplied.size,
      scanDurationMs: scanDuration,
    },
  }
}

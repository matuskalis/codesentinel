// Suppress pino logger output in action mode
process.env.LOG_LEVEL = 'silent'

import * as path from 'node:path'
import * as fs from 'node:fs'
import { buildFileChanges } from './walker.js'
import { runScan } from '@/lib/scanner'
import type { Severity, RuleFinding } from '@/types'

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

function annotationLevel(severity: Severity): 'error' | 'warning' | 'notice' {
  if (severity === 'critical' || severity === 'high') return 'error'
  if (severity === 'medium') return 'warning'
  return 'notice'
}

function sanitizeAnnotationMessage(text: string): string {
  return text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
}

function emitAnnotation(finding: RuleFinding): void {
  const level = annotationLevel(finding.severity)
  const file = finding.filePath
  const line = finding.startLine
  const endLine = finding.endLine
  const title = sanitizeAnnotationMessage(finding.title)
  const message = sanitizeAnnotationMessage(
    `${finding.description}\n\nFix: ${finding.fixSuggestion}`
  )

  process.stdout.write(
    `::${level} file=${file},line=${line},endLine=${endLine},title=${title}::${message}\n`
  )
}

function shouldFail(
  findings: { severity: Severity; confidence: string }[],
  failOn: Severity
): number {
  const threshold = SEVERITY_ORDER[failOn]

  if (failOn === 'low') {
    return findings.length
  }

  return findings.filter(
    f => SEVERITY_ORDER[f.severity] >= threshold && f.confidence === 'high'
  ).length
}

async function main(): Promise<void> {
  const directory = process.env.INPUT_DIRECTORY || '.'
  const failOn = (process.env.INPUT_FAIL_ON || 'high') as Severity

  if (!['critical', 'high', 'medium', 'low'].includes(failOn)) {
    process.stdout.write(
      `::error::Invalid fail-on value: "${failOn}". Must be one of: critical, high, medium, low\n`
    )
    process.exit(2)
  }

  const absoluteDir = path.resolve(directory)

  if (!fs.existsSync(absoluteDir)) {
    process.stdout.write(`::error::Directory not found: ${absoluteDir}\n`)
    process.exit(2)
  }

  const files = buildFileChanges(absoluteDir)
  const result = await runScan(files, [])

  // Emit annotations for each finding
  const sorted = [...result.findings].sort(
    (a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]
  )

  for (const finding of sorted) {
    emitAnnotation(finding)
  }

  // Grouped summary for the Actions log
  process.stdout.write('::group::CodeSentinel Scan Summary\n')
  process.stdout.write(`Files scanned: ${result.summary.filesScanned}\n`)
  process.stdout.write(`Rules applied: ${result.summary.rulesApplied}\n`)
  process.stdout.write(`Scan duration: ${result.summary.scanDurationMs}ms\n`)
  process.stdout.write(`Total findings: ${result.summary.totalFindings}\n`)
  process.stdout.write(`Risk score: ${result.riskScore}/100 (${result.riskLevel})\n`)

  if (result.summary.bySeverity.critical > 0) {
    process.stdout.write(`  Critical: ${result.summary.bySeverity.critical}\n`)
  }
  if (result.summary.bySeverity.high > 0) {
    process.stdout.write(`  High: ${result.summary.bySeverity.high}\n`)
  }
  if (result.summary.bySeverity.medium > 0) {
    process.stdout.write(`  Medium: ${result.summary.bySeverity.medium}\n`)
  }
  if (result.summary.bySeverity.low > 0) {
    process.stdout.write(`  Low: ${result.summary.bySeverity.low}\n`)
  }

  process.stdout.write('::endgroup::\n')

  // Set GitHub Actions outputs
  const outputFile = process.env.GITHUB_OUTPUT
  if (outputFile) {
    fs.appendFileSync(outputFile, `findings-count=${result.summary.totalFindings}\n`)
    fs.appendFileSync(outputFile, `risk-score=${result.riskScore}\n`)
    fs.appendFileSync(outputFile, `risk-level=${result.riskLevel}\n`)
  }

  // Determine if the scan should fail
  const blockingCount = shouldFail(result.findings, failOn)

  if (blockingCount > 0) {
    process.stdout.write(
      `\n::error::CodeSentinel found ${blockingCount} blocking finding(s) at ${failOn}+ severity. Scan failed.\n`
    )
    process.exit(1)
  }

  process.stdout.write('\nCodeSentinel scan passed — no blocking findings.\n')
}

main().catch(err => {
  process.stdout.write(
    `::error::CodeSentinel crashed: ${err instanceof Error ? err.message : String(err)}\n`
  )
  process.exit(2)
})

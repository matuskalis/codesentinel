import type { ReportInput, Severity } from '@/types'

const SEVERITY_EMOJI: Record<Severity, string> = {
  critical: '\u{1F534}',
  high: '\u{1F7E0}',
  medium: '\u{1F7E1}',
  low: '\u{1F535}',
}

const RISK_EMOJI: Record<string, string> = {
  critical: '\u{1F534}',
  high: '\u{1F7E0}',
  medium: '\u{1F7E1}',
  low: '\u{1F7E2}',
}

export function formatSummaryComment(input: ReportInput): string {
  const { result, commitSha, dashboardUrl, scanId } = input
  const { findings, riskScore, riskLevel, summary } = result

  const lines: string[] = []

  // Header
  lines.push(
    `## ${RISK_EMOJI[riskLevel] ?? '\u26AA'} CodeSentinel Security Report`
  )
  lines.push('')

  // Risk score
  lines.push(
    `**Risk Score:** ${riskScore}/100 (${riskLevel.toUpperCase()})`
  )
  lines.push('')

  // Summary table
  lines.push('| Severity | Count |')
  lines.push('|----------|-------|')
  for (const sev of ['critical', 'high', 'medium', 'low'] as Severity[]) {
    const count = summary.bySeverity[sev]
    if (count > 0) {
      const label = sev.charAt(0).toUpperCase() + sev.slice(1)
      lines.push(`| ${SEVERITY_EMOJI[sev]} ${label} | ${count} |`)
    }
  }
  lines.push('')

  // Top critical + high findings (max 10)
  const topFindings = findings
    .filter((f) => f.severity === 'critical' || f.severity === 'high')
    .slice(0, 10)

  if (topFindings.length > 0) {
    lines.push('### Top Findings')
    lines.push('')

    for (const finding of topFindings) {
      lines.push(
        `#### ${SEVERITY_EMOJI[finding.severity]} ${finding.title}`
      )
      lines.push(
        `**File:** \`${finding.filePath}:${finding.startLine}\``
      )
      lines.push('')
      lines.push(finding.description)
      lines.push('')
      lines.push('<details>')
      lines.push('<summary>Fix Suggestion</summary>')
      lines.push('')
      lines.push(finding.fixSuggestion)
      lines.push('')
      lines.push('</details>')
      lines.push('')
    }
  }

  if (summary.totalFindings === 0) {
    lines.push('### No security issues found!')
    lines.push('')
    lines.push('Great job! This PR passed all security checks.')
    lines.push('')
  }

  // Metadata footer
  lines.push('---')
  lines.push(
    `<sub>[View full report](${dashboardUrl}/scans/${scanId}) | ${summary.filesScanned} files scanned | ${summary.rulesApplied} rules applied | ${summary.scanDurationMs}ms</sub>`
  )
  lines.push(
    `<sub>Commit: ${commitSha.slice(0, 7)} | Powered by [CodeSentinel](${dashboardUrl})</sub>`
  )

  return lines.join('\n')
}

import type { ScanResult, Severity } from '@/types'

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const GREEN = '\x1b[32m'
const CYAN = '\x1b[36m'
const MAGENTA = '\x1b[35m'

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: RED,
  high: MAGENTA,
  medium: YELLOW,
  low: CYAN,
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

function severityLabel(severity: Severity): string {
  const color = SEVERITY_COLORS[severity]
  return `${color}${BOLD}${severity.toUpperCase().padEnd(8)}${RESET}`
}

function buildSeverityBreakdown(bySeverity: Record<Severity, number>): string {
  const parts: string[] = []
  if (bySeverity.critical > 0) parts.push(`${bySeverity.critical} critical`)
  if (bySeverity.high > 0) parts.push(`${bySeverity.high} high`)
  if (bySeverity.medium > 0) parts.push(`${bySeverity.medium} medium`)
  if (bySeverity.low > 0) parts.push(`${bySeverity.low} low`)
  return parts.join(', ')
}

export function formatTerminal(result: ScanResult, dir: string, version: string): string {
  const lines: string[] = []
  const { summary, findings, riskScore, riskLevel } = result

  lines.push('')
  lines.push(`${BOLD}CodeSentinel v${version}${RESET} ${DIM}— Preflight Security Gate${RESET}`)
  lines.push('')
  lines.push(`Scanning ${BOLD}${dir}${RESET}...`)
  lines.push(`${GREEN}\u2713${RESET} ${summary.filesScanned} files scanned in ${summary.scanDurationMs}ms`)
  lines.push(`${GREEN}\u2713${RESET} ${summary.rulesApplied} rules applied`)
  lines.push('')

  if (findings.length === 0) {
    const boxContent = `  ${GREEN}\u2713${RESET} ${BOLD}No findings${RESET} — clean scan!`
    const boxLine = '\u2500'.repeat(45)
    lines.push(`\u250C${boxLine}\u2510`)
    lines.push(`\u2502${boxContent.padEnd(45 + countAnsiChars(boxContent))}\u2502`)
    lines.push(`\u2514${boxLine}\u2518`)
  } else {
    const breakdown = buildSeverityBreakdown(summary.bySeverity)
    const riskColor = SEVERITY_COLORS[riskLevel] ?? YELLOW
    const findingsLine = `  \u2716 ${BOLD}${findings.length} findings${RESET} (${breakdown})`
    const scoreLine = `  Risk Score: ${riskColor}${BOLD}${riskScore}/100 (${riskLevel.toUpperCase()})${RESET}`
    const boxLine = '\u2500'.repeat(45)

    lines.push(`\u250C${boxLine}\u2510`)
    lines.push(`\u2502${padVisible(findingsLine, 45)}\u2502`)
    lines.push(`\u2502${padVisible(scoreLine, 45)}\u2502`)
    lines.push(`\u2514${boxLine}\u2518`)
    lines.push('')

    const sorted = [...findings].sort(
      (a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]
    )

    for (const finding of sorted) {
      lines.push(`  ${severityLabel(finding.severity)}${finding.title}`)
      lines.push(`            ${DIM}${finding.filePath}:${finding.startLine}${RESET}`)
      lines.push(`            ${DIM}\u2192 ${finding.fixSuggestion}${RESET}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

export function formatJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2)
}

export function formatFailMessage(failedCount: number, failSeverity: string): string {
  return `${RED}\u2716${RESET} Scan failed \u2014 ${failedCount} ${failSeverity}+ findings detected`
}

export function formatPassMessage(): string {
  return `${GREEN}\u2713${RESET} Scan passed \u2014 no blocking findings detected`
}

function countAnsiChars(str: string): number {
  // eslint-disable-next-line no-control-regex
  const ansiPattern = /\x1b\[[0-9;]*m/g
  let total = 0
  let match: RegExpExecArray | null
  while ((match = ansiPattern.exec(str)) !== null) {
    total += match[0].length
  }
  return total
}

function padVisible(str: string, width: number): string {
  const ansiLen = countAnsiChars(str)
  return str.padEnd(width + ansiLen)
}

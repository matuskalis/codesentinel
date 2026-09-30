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

const SEVERITY_LABEL_WIDTH = 10
const DETAIL_INDENT = ' '.repeat(SEVERITY_LABEL_WIDTH + 2)
const TERMINAL_WIDTH = 80

function severityLabel(severity: Severity): string {
  const color = SEVERITY_COLORS[severity]
  return `${color}${BOLD}${severity.toUpperCase().padEnd(SEVERITY_LABEL_WIDTH)}${RESET}`
}

function wrapText(text: string, width: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const word of text.split(/\s+/)) {
    if (current && current.length + 1 + word.length > width) {
      lines.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) lines.push(current)
  return lines
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
  lines.push(`${BOLD}CodeSentinel v${version}${RESET}  ${DIM}preflight security gate${RESET}`)
  lines.push('')
  lines.push(`Scanning ${BOLD}${dir}${RESET}`)
  lines.push(`${GREEN}\u2713${RESET} ${summary.filesScanned} files scanned in ${summary.scanDurationMs}ms`)
  if (summary.filesNotScanned > 0) {
    const verb = summary.filesNotScanned === 1 ? 'file was' : 'files were'
    lines.push(`${YELLOW}!${RESET} ${BOLD}Time limit reached:${RESET} ${summary.filesNotScanned} ${verb} not scanned`)
  }
  lines.push(`${GREEN}\u2713${RESET} ${summary.rulesApplied} rules applied`)
  lines.push('')

  if (findings.length === 0) {
    const boxContent =
      summary.filesNotScanned > 0
        ? `  ${YELLOW}!${RESET} ${BOLD}No findings${RESET} in the files scanned`
        : `  ${GREEN}\u2713${RESET} ${BOLD}No findings${RESET}, clean scan`
    const boxLine = '\u2500'.repeat(45)
    lines.push(`\u250C${boxLine}\u2510`)
    lines.push(`\u2502${boxContent.padEnd(45 + countAnsiChars(boxContent))}\u2502`)
    lines.push(`\u2514${boxLine}\u2518`)
  } else {
    const breakdown = buildSeverityBreakdown(summary.bySeverity)
    const riskColor = SEVERITY_COLORS[riskLevel] ?? YELLOW
    const findingsLine = `  \u2716 ${BOLD}${findings.length} ${findings.length === 1 ? 'finding' : 'findings'}${RESET} (${breakdown})`
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
      const fixLines = wrapText(finding.fixSuggestion, TERMINAL_WIDTH - DETAIL_INDENT.length - 2)
      lines.push(`  ${severityLabel(finding.severity)}${finding.title}`)
      lines.push(`${DETAIL_INDENT}${DIM}${finding.filePath}:${finding.startLine}  ${finding.ruleId}${RESET}`)
      fixLines.forEach((fixLine, index) => {
        const prefix = index === 0 ? '\u2192 ' : '  '
        lines.push(`${DETAIL_INDENT}${DIM}${prefix}${fixLine}${RESET}`)
      })
      lines.push('')
    }
  }

  return lines.join('\n')
}

export function formatJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2)
}

export function formatFailMessage(failedCount: number, failSeverity: string): string {
  const noun = failedCount === 1 ? 'finding' : 'findings'
  return `${RED}\u2716${RESET} Scan failed: ${failedCount} blocking ${noun} at ${failSeverity} or above`
}

export function formatPassMessage(reportedCount = 0): string {
  const passed = `${GREEN}\u2713${RESET} Scan passed: no blocking findings`
  if (reportedCount === 0) return passed

  const hint = 'Findings block only at high confidence (--fail-on low blocks on any finding).'
  return `${passed} (${reportedCount} reported)\n  ${DIM}${hint}${RESET}`
}

export function formatIncompleteMessage(): string {
  return `${RED}\u2716${RESET} Scan incomplete, not a pass. Raise the time limit with CODESENTINEL_SCAN_TIMEOUT_MS (milliseconds).`
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

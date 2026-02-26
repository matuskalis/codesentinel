import type { RuleFinding, Severity } from '@/types'

const SEVERITY_EMOJI: Record<Severity, string> = {
  critical: '\u{1F534}',
  high: '\u{1F7E0}',
  medium: '\u{1F7E1}',
  low: '\u{1F535}',
}

const MAX_INLINE_COMMENTS = 20

export interface InlineComment {
  path: string
  line: number
  body: string
}

export function formatInlineComments(
  findings: RuleFinding[]
): InlineComment[] {
  const eligible = findings
    .filter((f) => f.severity === 'critical' || f.severity === 'high')
    .slice(0, MAX_INLINE_COMMENTS)

  return eligible.map((finding) => ({
    path: finding.filePath,
    line: finding.startLine,
    body: formatInlineBody(finding),
  }))
}

function formatInlineBody(finding: RuleFinding): string {
  const emoji = SEVERITY_EMOJI[finding.severity]
  return [
    `${emoji} **${finding.title}** (${finding.severity})`,
    '',
    finding.description,
    '',
    `**Fix:** ${finding.fixSuggestion}`,
  ].join('\n')
}

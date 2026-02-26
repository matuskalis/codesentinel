import type { RuleDefinition, RuleFinding } from '@/types'
import { createFingerprint } from './fingerprint'

const DANGEROUS_INNER_HTML_PATTERN = /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*(.+?)\s*\}\s*\}/
const STRING_LITERAL_PATTERN = /^(['"`]).*\1$/

export const dangerousInnerHtmlRule: RuleDefinition = {
  id: 'dangerous-innerhtml',
  name: 'Dangerous innerHTML with Dynamic Content',
  description: 'Detects dangerouslySetInnerHTML usage with dynamic (unsanitized) content.',
  severity: 'high',
  confidence: 'medium',
  category: 'nextjs',
  tags: ['xss', 'nextjs', 'react'],
  version: 1,
  applicableTo: {
    languages: ['typescript', 'javascript'],
  },

  run(file, classification) {
    const findings: RuleFinding[] = []

    if (classification.isTest) return findings

    const lines = file.content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNumber = i + 1
      const trimmed = line.trim()

      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue

      const match = DANGEROUS_INNER_HTML_PATTERN.exec(line)
      if (!match) continue

      const htmlValue = match[1].trim()

      if (STRING_LITERAL_PATTERN.test(htmlValue)) continue

      const snippet = trimmed
      findings.push({
        ruleId: 'dangerous-innerhtml',
        ruleVersion: 1,
        severity: 'high',
        confidence: 'medium',
        title: 'dangerouslySetInnerHTML with dynamic content',
        description: `\`dangerouslySetInnerHTML\` is used with a dynamic value (\`${htmlValue}\`) at line ${lineNumber}, which may allow XSS attacks.`,
        explanation: 'React\'s `dangerouslySetInnerHTML` bypasses the built-in XSS protection. When used with dynamic or user-controlled content, it can allow attackers to inject malicious scripts that execute in other users\' browsers.',
        fixSuggestion: "Use a sanitization library like `DOMPurify` before passing content to `dangerouslySetInnerHTML`, or use React's built-in text rendering which auto-escapes.",
        filePath: file.filePath,
        startLine: lineNumber,
        endLine: lineNumber,
        snippet,
        fingerprint: createFingerprint('dangerous-innerhtml', file.filePath, snippet),
      })
    }

    return findings
  },
}

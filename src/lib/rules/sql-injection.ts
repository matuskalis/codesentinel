import type { RuleDefinition, RuleFinding } from '@/types'
import { createFingerprint } from './fingerprint'

const SQL_KEYWORDS = /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b/i

const TEMPLATE_LITERAL_INTERPOLATION = /`[^`]*\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b[^`]*\$\{[^}]+\}[^`]*`/i

const STRING_CONCAT_SQL = /(['"])\s*\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b[^'"]*\1\s*\+\s*\w+/i
const STRING_CONCAT_SQL_REVERSE = /\w+\s*\+\s*(['"])\s*\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b/i

const ORM_TAGGED_TEMPLATE = /\b(sql|Prisma\.sql|Prisma\.raw)\s*`/
const PARAMETERIZED_QUERY = /\$[0-9]+|(?<!\$)\?(?!\.)/

export const sqlInjectionRule: RuleDefinition = {
  id: 'sql-injection',
  name: 'SQL Injection via String Interpolation',
  description: 'Detects SQL queries built with string interpolation or concatenation, which may be vulnerable to SQL injection.',
  severity: 'critical',
  confidence: 'high',
  category: 'api',
  tags: ['sql', 'injection'],
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

      if (!SQL_KEYWORDS.test(line)) continue

      if (ORM_TAGGED_TEMPLATE.test(line)) continue
      if (PARAMETERIZED_QUERY.test(line)) continue

      let detected = false

      if (TEMPLATE_LITERAL_INTERPOLATION.test(line)) {
        detected = true
      }

      if (!detected && (STRING_CONCAT_SQL.test(line) || STRING_CONCAT_SQL_REVERSE.test(line))) {
        detected = true
      }

      if (!detected) continue

      const snippet = trimmed
      findings.push({
        ruleId: 'sql-injection',
        ruleVersion: 1,
        severity: 'critical',
        confidence: 'high',
        title: 'Potential SQL injection via string interpolation',
        description: `A SQL query at line ${lineNumber} uses string interpolation or concatenation, which may be vulnerable to SQL injection.`,
        explanation: 'Building SQL queries with string interpolation or concatenation allows attackers to inject malicious SQL code through user-controlled input. This can lead to data theft, data modification, or complete database compromise.',
        fixSuggestion: "Use parameterized queries or your ORM's query builder instead of string interpolation in SQL statements.",
        filePath: file.filePath,
        startLine: lineNumber,
        endLine: lineNumber,
        snippet,
        fingerprint: createFingerprint('sql-injection', file.filePath, snippet),
      })
    }

    return findings
  },
}

import type { RuleDefinition, RuleFinding } from '@/types'
import { createFingerprint } from './fingerprint'

interface SecretPattern {
  name: string
  regex: RegExp
  severityOverride?: RuleFinding['severity']
}

const SECRET_PATTERNS: SecretPattern[] = [
  { name: 'Stripe live secret key', regex: /sk_live_[a-zA-Z0-9]{24,}/ },
  { name: 'Stripe test secret key', regex: /sk_test_[a-zA-Z0-9]{24,}/, severityOverride: 'medium' },
  { name: 'AWS access key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub personal access token', regex: /ghp_[a-zA-Z0-9]{36}/ },
  { name: 'OpenAI API key', regex: /sk-[a-zA-Z0-9]{32,}/ },
  { name: 'SendGrid API key', regex: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/ },
  { name: 'Slack bot token', regex: /xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/ },
  { name: 'JWT token', regex: /eyJ[a-zA-Z0-9_-]{20,}\.eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/ },
]

const PLACEHOLDER_PATTERNS = /your_key_here|REPLACE_ME|xxx{3,}|placeholder|changeme|TODO/i

const EXAMPLE_FILE_PATTERNS = /\.example$|\.sample$|\.template$|\.example\.|\.sample\.|\.template\./i
const FIXTURE_PATTERNS = /\/__fixtures__\/|\/fixtures\/|\/snapshots\/|\.snap$|\.fixture\./i
const AUTOGEN_DOCS_PATTERNS = /\/documentation\/.*\.json$|\/swagger\.json$|\/openapi\.json$|\/api-docs\.json$/i

// Well-known example JWTs used in tutorials and auto-generated docs
const KNOWN_EXAMPLE_JWTS = new Set([
  // jwt.io canonical example (sub: "1234567890", name: "John Doe")
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ',
])

function isExampleOrFixtureFile(filePath: string): boolean {
  return EXAMPLE_FILE_PATTERNS.test(filePath) || FIXTURE_PATTERNS.test(filePath)
}

function isAutogenDocsFile(filePath: string): boolean {
  return AUTOGEN_DOCS_PATTERNS.test(filePath)
}

function isKnownExampleJwt(jwtValue: string): boolean {
  // Compare only header.payload (first two segments) to ignore signature variants
  const parts = jwtValue.split('.')
  if (parts.length < 2) return false
  return KNOWN_EXAMPLE_JWTS.has(parts[0] + '.' + parts[1])
}

function isSupabaseAnonKey(jwtValue: string): boolean {
  try {
    const payloadPart = jwtValue.split('.')[1]
    if (!payloadPart) return false
    const decoded = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(decoded)
    return payload.role === 'anon' || payload.role === 'supabase-demo'
  } catch {
    return false
  }
}

function isCommentLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

function isEnvReference(line: string): boolean {
  return /process\.env\b/.test(line) || /import\.meta\.env\b/.test(line)
}

export const hardcodedSecretsRule: RuleDefinition = {
  id: 'hardcoded-secrets',
  name: 'Hardcoded Secrets',
  description: 'Detects hardcoded API keys, tokens, and other secrets in source code.',
  severity: 'critical',
  confidence: 'high',
  category: 'secrets',
  tags: ['secrets'],
  version: 1,
  applicableTo: {
    languages: ['typescript', 'javascript', 'json', 'yaml', 'env'],
  },

  run(file, classification) {
    const findings: RuleFinding[] = []

    if (classification.isTest) return findings
    if (isExampleOrFixtureFile(file.filePath)) return findings
    if (isAutogenDocsFile(file.filePath)) return findings

    const lines = file.content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNumber = i + 1

      if (isCommentLine(line)) continue
      if (isEnvReference(line)) continue
      if (PLACEHOLDER_PATTERNS.test(line)) continue

      for (const pattern of SECRET_PATTERNS) {
        const match = pattern.regex.exec(line)
        if (!match) continue

        const matchedValue = match[0]
        if (PLACEHOLDER_PATTERNS.test(matchedValue)) continue
        if (pattern.name === 'JWT token' && (isSupabaseAnonKey(matchedValue) || isKnownExampleJwt(matchedValue))) continue

        const snippet = line.trim()
        findings.push({
          ruleId: 'hardcoded-secrets',
          ruleVersion: 1,
          severity: pattern.severityOverride ?? 'critical',
          confidence: 'high',
          title: `Hardcoded ${pattern.name} detected`,
          description: `A ${pattern.name} was found hardcoded in the source code at line ${lineNumber}.`,
          explanation: `Hardcoded secrets in source code can be extracted by anyone with access to the repository. This ${pattern.name} should be stored in environment variables and never committed to version control.`,
          fixSuggestion: 'Move this secret to environment variables and access it via `process.env.YOUR_SECRET_NAME`.',
          filePath: file.filePath,
          startLine: lineNumber,
          endLine: lineNumber,
          snippet,
          fingerprint: createFingerprint('hardcoded-secrets', file.filePath, snippet),
        })
      }
    }

    return findings
  },
}

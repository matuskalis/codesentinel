import type { RuleDefinition, RuleFinding } from '@/types'
import { createFingerprint } from './fingerprint'

const SAFE_ENV_PATTERNS = ['.env.example', '.env.sample', '.env.template']

const PLACEHOLDER_PREFIX = /^(your[_-]|REPLACE|CHANGEME|TODO|placeholder|example|CHANGE[_-]THIS|UPDATE[_-]THIS|INSERT[_-]|PUT[_-]YOUR|ADD[_-]YOUR|ENTER[_-]YOUR|FILL[_-]IN)/i
const PLACEHOLDER_SUFFIX = /[_-]x{2,}$/i
const GENERIC_VALUE = /^(0|123|test|true|false|none|null|undefined|n\/a|na|tbd)$/i
const TEMPLATE_MARKER = /^<[^>]+>$/
const LOCALHOST_URL = /^https?:\/\/localhost/i

const SENSITIVE_VAR_NAME = /SECRET|_KEY|TOKEN|PASSWORD|PRIVATE|CREDENTIAL/i
const KNOWN_SECRET_PREFIX = /^(sk_(?:live|test)_[a-zA-Z0-9]{10,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|sk-[a-zA-Z0-9]{20,}|SG\.[a-zA-Z0-9_-]{22}\.|xoxb-|re_(?:live|test)_[a-zA-Z0-9]|eyJ[a-zA-Z0-9_-]{20,}\.eyJ)/
const DB_URL_WITH_CREDS = /^(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:]+:[^@]+@/

function isPlaceholderValue(value: string): boolean {
  const v = value.trim().replace(/^["']|["']$/g, '')
  if (v === '') return true
  if (PLACEHOLDER_PREFIX.test(v)) return true
  if (PLACEHOLDER_SUFFIX.test(v)) return true
  if (GENERIC_VALUE.test(v)) return true
  if (TEMPLATE_MARKER.test(v)) return true
  if (LOCALHOST_URL.test(v)) return true
  return false
}

function hasRealSecrets(content: string): boolean {
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const varName = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()

    if (isPlaceholderValue(value)) continue

    // Value matches a known secret pattern → definitely real
    if (KNOWN_SECRET_PREFIX.test(value) || DB_URL_WITH_CREDS.test(value)) return true

    // Sensitive var name with non-placeholder, non-URL value
    if (SENSITIVE_VAR_NAME.test(varName) && !/^https?:\/\//i.test(value)) return true
  }
  return false
}

export const envCommittedRule: RuleDefinition = {
  id: 'env-committed',
  name: 'Environment File Committed',
  description: 'Detects .env files with real values being committed to the repository.',
  severity: 'critical',
  confidence: 'high',
  category: 'secrets',
  tags: ['secrets', 'config'],
  version: 2,
  applicableTo: {
    filePatterns: ['*.env', '*.env.local', '*.env.production', '*.env.development'],
  },

  run(file) {
    const findings: RuleFinding[] = []

    const isSafeFile = SAFE_ENV_PATTERNS.some(pattern => file.filePath.endsWith(pattern))
    if (isSafeFile) return findings

    if (file.status !== 'added' && file.status !== 'modified') return findings

    if (!hasRealSecrets(file.content)) return findings

    const snippet = file.filePath
    findings.push({
      ruleId: 'env-committed',
      ruleVersion: 2,
      severity: 'critical',
      confidence: 'high',
      title: 'Environment file with secrets committed',
      description: `The file \`${file.filePath}\` contains environment variables with real values and is being committed to the repository.`,
      explanation: 'Environment files often contain database credentials, API keys, and other secrets. Committing them to version control exposes these secrets to anyone with repository access and preserves them in git history.',
      fixSuggestion: 'Add this file to `.gitignore` and use `.env.example` with placeholder values instead.',
      filePath: file.filePath,
      startLine: 1,
      endLine: file.content.split('\n').length,
      snippet,
      fingerprint: createFingerprint('env-committed', file.filePath, snippet),
    })

    return findings
  },
}

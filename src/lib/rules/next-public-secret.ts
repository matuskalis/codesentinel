import type { RuleDefinition, RuleFinding } from '@/types'
import { createFingerprint } from './fingerprint'

const SECRET_KEYWORD_PATTERN = /^NEXT_PUBLIC_.*(?:SECRET|KEY|TOKEN|PASSWORD|PRIVATE).*=(.+)$/i
const PLACEHOLDER_PATTERNS = /your_key_here|REPLACE_ME|xxx{3,}|placeholder|changeme|TODO|<.*>/i
const SAFE_PUBLIC_VARS = /SUPABASE_ANON_KEY|PUBLISHABLE_KEY|PUBLIC_KEY|CLOUDINARY_API_KEY/i
const SAFE_VALUE_PATTERNS = /^(pk_(?:test|live)_|https?:\/\/)/i

export const nextPublicSecretRule: RuleDefinition = {
  id: 'next-public-secret',
  name: 'Secret Exposed via NEXT_PUBLIC_ Prefix',
  description: 'Detects secrets exposed to the client via NEXT_PUBLIC_ environment variable prefix.',
  severity: 'high',
  confidence: 'high',
  category: 'nextjs',
  tags: ['secrets', 'nextjs'],
  version: 1,
  applicableTo: {
    filePatterns: ['.env'],
  },

  run(file) {
    const findings: RuleFinding[] = []

    if (/\.(example|sample|template)$/i.test(file.filePath)) {
      return findings
    }

    const lines = file.content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      const lineNumber = i + 1

      if (trimmed === '' || trimmed.startsWith('#')) continue

      const match = SECRET_KEYWORD_PATTERN.exec(trimmed)
      if (!match) continue

      const varName = trimmed.split('=')[0]
      if (SAFE_PUBLIC_VARS.test(varName)) continue

      const value = match[1].trim()
      if (value === '' || value === '""' || value === "''" || PLACEHOLDER_PATTERNS.test(value)) continue
      if (SAFE_VALUE_PATTERNS.test(value)) continue

      const snippet = trimmed
      findings.push({
        ruleId: 'next-public-secret',
        ruleVersion: 1,
        severity: 'high',
        confidence: 'high',
        title: 'Secret exposed via NEXT_PUBLIC_ prefix',
        description: `The environment variable on line ${lineNumber} uses the \`NEXT_PUBLIC_\` prefix, which exposes its value to client-side JavaScript bundles.`,
        explanation: 'Variables prefixed with `NEXT_PUBLIC_` are inlined into the client-side JavaScript bundle at build time. Secrets, keys, tokens, and passwords should never use this prefix as they will be visible to anyone inspecting the browser JavaScript.',
        fixSuggestion: 'Remove the `NEXT_PUBLIC_` prefix so the secret stays server-side. Use a server action or API route to access this value.',
        filePath: file.filePath,
        startLine: lineNumber,
        endLine: lineNumber,
        snippet,
        fingerprint: createFingerprint('next-public-secret', file.filePath, snippet),
      })
    }

    return findings
  },
}

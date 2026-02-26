import type { RuleDefinition, RuleFinding } from '@/types'
import { createFingerprint } from './fingerprint'

const SERVICE_ROLE_PATTERNS = [
  { regex: /SUPABASE_SERVICE_ROLE_KEY/, label: 'SUPABASE_SERVICE_ROLE_KEY reference' },
  { regex: /supabaseServiceRoleKey/, label: 'supabaseServiceRoleKey variable' },
  { regex: /service_role/, label: 'service_role reference' },
  { regex: /serviceRole/, label: 'serviceRole reference' },
]

export const supabaseServiceKeyClientRule: RuleDefinition = {
  id: 'supabase-service-key-client',
  name: 'Supabase Service Role Key in Client Code',
  description: 'Detects usage of the Supabase service role key in client-side code, which exposes full database access.',
  severity: 'critical',
  confidence: 'high',
  category: 'supabase',
  tags: ['supabase', 'secrets'],
  version: 1,
  applicableTo: {
    languages: ['typescript', 'javascript'],
    contexts: ['client'],
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

      for (const pattern of SERVICE_ROLE_PATTERNS) {
        if (!pattern.regex.test(line)) continue

        const snippet = trimmed
        findings.push({
          ruleId: 'supabase-service-key-client',
          ruleVersion: 1,
          severity: 'critical',
          confidence: 'high',
          title: `Supabase service role key used in client code`,
          description: `A ${pattern.label} was found in client-side code at line ${lineNumber}. The service role key bypasses Row Level Security and grants full database access.`,
          explanation: 'The Supabase service role key has full admin access to your database, bypassing all Row Level Security policies. If exposed in client-side code, it is visible to anyone who inspects the JavaScript bundle, allowing them to read, modify, or delete any data.',
          fixSuggestion: 'Never use the Supabase service role key in client-side code. Use the anon key for client-side and service role key only in server-side API routes.',
          filePath: file.filePath,
          startLine: lineNumber,
          endLine: lineNumber,
          snippet,
          fingerprint: createFingerprint('supabase-service-key-client', file.filePath, snippet),
        })

        break
      }
    }

    return findings
  },
}

import type { RuleDefinition, FileClassification } from '@/types'

import { hardcodedSecretsRule } from './hardcoded-secrets'
import { envCommittedRule } from './env-committed'
import { nextPublicSecretRule } from './next-public-secret'
import { supabaseServiceKeyClientRule } from './supabase-service-key-client'
import { stripeNoWebhookVerifyRule } from './stripe-no-webhook-verify'

export { createFingerprint } from './fingerprint'

export const allRules: RuleDefinition[] = [
  hardcodedSecretsRule,
  envCommittedRule,
  nextPublicSecretRule,
  stripeNoWebhookVerifyRule,
  supabaseServiceKeyClientRule,
]

export function getRulesForFile(classification: FileClassification): RuleDefinition[] {
  return allRules.filter(rule => {
    const { applicableTo } = rule

    if (applicableTo.languages && applicableTo.languages.length > 0) {
      if (!applicableTo.languages.includes(classification.language)) return false
    }

    if (applicableTo.contexts && applicableTo.contexts.length > 0) {
      if (!applicableTo.contexts.includes(classification.context)) return false
    }

    if (applicableTo.routeTypes && applicableTo.routeTypes.length > 0) {
      if (!applicableTo.routeTypes.includes(classification.routeType)) return false
    }

    if (applicableTo.filePatterns && applicableTo.filePatterns.length > 0) {
      const matches = applicableTo.filePatterns.some(pattern => {
        if (pattern.startsWith('*.')) {
          return classification.filePath.endsWith(pattern.slice(1))
        }
        return classification.filePath.includes(pattern)
      })
      if (!matches) return false
    }

    return true
  })
}

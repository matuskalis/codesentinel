import type { RuleDefinition, RuleFinding } from '@/types'
import { createFingerprint } from './fingerprint'

const STRIPE_IMPORT = /(?:import\s+.*from\s+['"]stripe['"]|require\s*\(\s*['"]stripe['"]\s*\)|new\s+Stripe\s*\(|stripe\.)/
const WEBHOOK_PATH = /\/webhook|stripe[_-]webhook|webhook[_-]handler/i
const VERIFICATION_PATTERN = /constructEvent|stripe-signature|webhookEndpointSecret|webhook_secret|whsec_/
const POST_HANDLER = /export\s+(?:async\s+)?function\s+POST|\.post\s*\(|method.*POST|request\.method\s*===?\s*['"]POST['"]/

export const stripeNoWebhookVerifyRule: RuleDefinition = {
  id: 'stripe-no-webhook-verify',
  name: 'Stripe Webhook Missing Signature Verification',
  description: 'Detects Stripe webhook handlers that do not verify the webhook signature.',
  severity: 'high',
  confidence: 'medium',
  category: 'stripe',
  tags: ['stripe', 'webhook'],
  version: 1,
  applicableTo: {
    languages: ['typescript', 'javascript'],
    routeTypes: ['api-route'],
  },

  run(file, classification) {
    const findings: RuleFinding[] = []

    if (classification.isTest) return findings

    const content = file.content

    const hasStripe = STRIPE_IMPORT.test(content)
    const isWebhookPath = WEBHOOK_PATH.test(classification.filePath)
    const hasVerification = VERIFICATION_PATTERN.test(content)
    const hasPostHandler = POST_HANDLER.test(content)

    if (hasStripe && isWebhookPath && hasPostHandler && !hasVerification) {
      const lines = content.split('\n')
      let webhookLine = 1
      for (let i = 0; i < lines.length; i++) {
        if (STRIPE_IMPORT.test(lines[i])) {
          webhookLine = i + 1
          break
        }
      }

      const snippet = lines[webhookLine - 1]?.trim() ?? file.filePath
      findings.push({
        ruleId: 'stripe-no-webhook-verify',
        ruleVersion: 1,
        severity: 'high',
        confidence: 'medium',
        title: 'Stripe webhook handler missing signature verification',
        description: `The file \`${file.filePath}\` handles Stripe webhooks but does not verify the webhook signature using \`constructEvent\`.`,
        explanation: 'Without signature verification, anyone can send forged webhook events to your endpoint. An attacker could fake payment confirmations, subscription changes, or other critical events, leading to unauthorized access or financial fraud.',
        fixSuggestion: 'Add Stripe webhook signature verification using `stripe.webhooks.constructEvent(body, sig, webhookSecret)` to prevent forged webhook events.',
        filePath: file.filePath,
        startLine: webhookLine,
        endLine: webhookLine,
        snippet,
        fingerprint: createFingerprint('stripe-no-webhook-verify', file.filePath, snippet),
      })
    }

    return findings
  },
}

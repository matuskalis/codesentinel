import type { RuleDefinition, RuleFinding } from '@/types'
import { createFingerprint } from './fingerprint'

interface ServiceKeyPattern {
  regex: RegExp
  label: string
}

const SERVICE_KEY_PATTERNS: ServiceKeyPattern[] = [
  { regex: /firebase-admin/, label: 'Firebase Admin SDK import' },
  { regex: /["']type["']\s*:\s*["']service_account["']/, label: 'Service account JSON type field' },
  { regex: /["']private_key["']\s*:/, label: 'Service account private key field' },
  { regex: /["']client_email["']\s*:.*iam\.gserviceaccount\.com/, label: 'GCP service account email' },
  { regex: /GOOGLE_APPLICATION_CREDENTIALS/, label: 'GOOGLE_APPLICATION_CREDENTIALS reference' },
  { regex: /google-credentials/, label: 'Google credentials reference' },
]

export const exposedServiceKeysRule: RuleDefinition = {
  id: 'exposed-service-keys',
  name: 'Service Account Keys in Client Code',
  description: 'Detects Firebase Admin SDK, GCP service account credentials, and other service keys exposed in client or shared code.',
  severity: 'critical',
  confidence: 'high',
  category: 'secrets',
  tags: ['secrets', 'firebase', 'gcp'],
  version: 1,
  applicableTo: {
    languages: ['typescript', 'javascript', 'json'],
    contexts: ['client', 'shared'],
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

      for (const pattern of SERVICE_KEY_PATTERNS) {
        if (!pattern.regex.test(line)) continue

        const snippet = trimmed
        findings.push({
          ruleId: 'exposed-service-keys',
          ruleVersion: 1,
          severity: 'critical',
          confidence: 'high',
          title: `${pattern.label} found in ${classification.context} code`,
          description: `A ${pattern.label} was detected in ${classification.context}-side code at line ${lineNumber}. Service account credentials must never be exposed to the client.`,
          explanation: 'Service account credentials and admin SDK keys have elevated privileges that bypass security rules. When exposed in client or shared code, they are bundled into JavaScript accessible by any user, allowing full unauthorized access to backend services.',
          fixSuggestion: 'Move service account credentials and admin SDK usage to server-side only. Never import `firebase-admin` or expose service account keys in client code.',
          filePath: file.filePath,
          startLine: lineNumber,
          endLine: lineNumber,
          snippet,
          fingerprint: createFingerprint('exposed-service-keys', file.filePath, snippet),
        })

        break
      }
    }

    return findings
  },
}

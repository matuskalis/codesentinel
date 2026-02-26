import type { RuleDefinition, RuleFinding } from '@/types'
import { createFingerprint } from './fingerprint'

const CORS_WILDCARD_HEADER = /['"]Access-Control-Allow-Origin['"]\s*,\s*['"]\*['"]/
const CORS_ORIGIN_WILDCARD = /origin\s*:\s*['"]\*['"]/

export const permissiveCorsRule: RuleDefinition = {
  id: 'permissive-cors',
  name: 'Permissive CORS Configuration',
  description: 'Detects wildcard (*) CORS origin configuration that allows any website to make requests.',
  severity: 'medium',
  confidence: 'high',
  category: 'api',
  tags: ['cors', 'api'],
  version: 1,
  applicableTo: {
    languages: ['typescript', 'javascript'],
    routeTypes: ['api-route'],
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

      const isWildcardHeader = CORS_WILDCARD_HEADER.test(line)
      const isWildcardOrigin = CORS_ORIGIN_WILDCARD.test(line)

      if (!isWildcardHeader && !isWildcardOrigin) continue

      const snippet = trimmed
      findings.push({
        ruleId: 'permissive-cors',
        ruleVersion: 1,
        severity: 'medium',
        confidence: 'high',
        title: 'Wildcard CORS origin allows any website',
        description: `The CORS configuration at line ${lineNumber} uses a wildcard origin (\`*\`), allowing any website to make cross-origin requests to this API.`,
        explanation: 'Setting `Access-Control-Allow-Origin: *` allows any website to make requests to this API endpoint. If the API handles sensitive data or requires authentication, this can enable cross-site request attacks from malicious websites.',
        fixSuggestion: 'Replace wildcard CORS with a specific allowed origin list. Use an environment variable for the allowed origin.',
        filePath: file.filePath,
        startLine: lineNumber,
        endLine: lineNumber,
        snippet,
        fingerprint: createFingerprint('permissive-cors', file.filePath, snippet),
      })
    }

    return findings
  },
}

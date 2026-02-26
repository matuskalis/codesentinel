import type { RuleDefinition, RuleFinding } from '@/types'
import { createFingerprint } from './fingerprint'

const AUTH_COOKIE_NAMES = /['"](?:session|auth|token|jwt|sid|access_token|refresh_token)['"]/i

const COOKIE_SETTERS = [
  /Set-Cookie/i,
  /\.cookie\s*\(/,
  /cookies\(\)\.set\s*\(/,
  /setCookie\s*\(/,
]

const SECURITY_FLAGS = {
  httpOnly: /httpOnly\s*:\s*true/,
  secure: /secure\s*:\s*true/,
  sameSite: /sameSite\s*:/,
}

const INSECURE_FLAGS = {
  httpOnlyFalse: /httpOnly\s*:\s*false/,
  secureFalse: /secure\s*:\s*false/,
}

export const insecureCookieFlagsRule: RuleDefinition = {
  id: 'insecure-cookie-flags',
  name: 'Insecure Cookie Flags',
  description: 'Detects authentication cookies missing security flags (httpOnly, secure, sameSite).',
  severity: 'medium',
  confidence: 'high',
  category: 'auth',
  tags: ['auth', 'cookies'],
  version: 1,
  applicableTo: {
    languages: ['typescript', 'javascript'],
  },

  run(file, classification) {
    const findings: RuleFinding[] = []

    if (classification.isTest) return findings

    const lines = file.content.split('\n')
    const content = file.content

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNumber = i + 1
      const trimmed = line.trim()

      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue

      const isCookieSetter = COOKIE_SETTERS.some(pattern => pattern.test(line))
      if (!isCookieSetter) continue

      const hasAuthCookieName = AUTH_COOKIE_NAMES.test(line)
      const contextWindow = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 10)).join('\n')
      const hasAuthCookieInContext = AUTH_COOKIE_NAMES.test(contextWindow)

      if (!hasAuthCookieName && !hasAuthCookieInContext) continue

      const missingFlags: string[] = []

      if (!SECURITY_FLAGS.httpOnly.test(contextWindow) || INSECURE_FLAGS.httpOnlyFalse.test(contextWindow)) {
        missingFlags.push('httpOnly')
      }
      if (!SECURITY_FLAGS.secure.test(contextWindow) || INSECURE_FLAGS.secureFalse.test(contextWindow)) {
        missingFlags.push('secure')
      }
      if (!SECURITY_FLAGS.sameSite.test(contextWindow)) {
        missingFlags.push('sameSite')
      }

      if (missingFlags.length === 0) continue

      const snippet = trimmed
      findings.push({
        ruleId: 'insecure-cookie-flags',
        ruleVersion: 1,
        severity: 'medium',
        confidence: 'high',
        title: `Authentication cookie missing security flags: ${missingFlags.join(', ')}`,
        description: `A cookie setter at line ${lineNumber} for an authentication cookie is missing the following security flags: ${missingFlags.join(', ')}.`,
        explanation: `Missing security flags on authentication cookies creates vulnerabilities: without \`httpOnly\`, scripts can steal the cookie via XSS; without \`secure\`, the cookie is sent over plain HTTP; without \`sameSite\`, the cookie is vulnerable to CSRF attacks.`,
        fixSuggestion: "Add security flags to authentication cookies: `httpOnly: true, secure: true, sameSite: 'lax'`.",
        filePath: file.filePath,
        startLine: lineNumber,
        endLine: lineNumber,
        snippet,
        fingerprint: createFingerprint('insecure-cookie-flags', file.filePath, snippet),
      })
    }

    return findings
  },
}

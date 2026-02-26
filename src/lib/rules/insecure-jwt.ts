import type { RuleDefinition, RuleFinding } from '@/types'
import { createFingerprint } from './fingerprint'

const JWT_VERIFY_NO_ALGO = /jwt\.verify\s*\([^)]*\)/
const JWT_VERIFY_WITH_ALGORITHMS = /algorithms\s*:/
const ALGORITHMS_NONE = /algorithms\s*:\s*\[\s*['"]none['"]\s*\]/
const JWT_DECODE = /jwt\.decode\s*\(/

export const insecureJwtRule: RuleDefinition = {
  id: 'insecure-jwt',
  name: 'Insecure JWT Configuration',
  description: 'Detects insecure JWT verification patterns including missing algorithm specification and use of jwt.decode for authentication.',
  severity: 'high',
  confidence: 'high',
  category: 'auth',
  tags: ['jwt', 'auth'],
  version: 1,
  applicableTo: {
    languages: ['typescript', 'javascript'],
  },

  run(file, classification) {
    const findings: RuleFinding[] = []

    if (classification.isTest) return findings

    const lines = file.content.split('\n')
    const fullContent = file.content

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNumber = i + 1
      const trimmed = line.trim()

      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue

      if (ALGORITHMS_NONE.test(line)) {
        const snippet = trimmed
        findings.push({
          ruleId: 'insecure-jwt',
          ruleVersion: 1,
          severity: 'high',
          confidence: 'high',
          title: 'JWT configured with "none" algorithm',
          description: `JWT at line ${lineNumber} is configured with \`algorithms: ['none']\`, which disables signature verification entirely.`,
          explanation: 'The "none" algorithm means the JWT is not signed at all. Any attacker can forge tokens by setting the algorithm to "none" and the server will accept them without verification.',
          fixSuggestion: "Always specify the `algorithms` option in `jwt.verify()` (e.g., `{ algorithms: ['HS256'] }`). Never use `algorithms: ['none']`. Use `jwt.verify()` instead of `jwt.decode()` for authentication.",
          filePath: file.filePath,
          startLine: lineNumber,
          endLine: lineNumber,
          snippet,
          fingerprint: createFingerprint('insecure-jwt', file.filePath, snippet),
        })
        continue
      }

      if (JWT_VERIFY_NO_ALGO.test(line) && !JWT_VERIFY_WITH_ALGORITHMS.test(line)) {
        const contextWindow = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 5)).join('\n')
        if (JWT_VERIFY_WITH_ALGORITHMS.test(contextWindow)) continue

        const snippet = trimmed
        findings.push({
          ruleId: 'insecure-jwt',
          ruleVersion: 1,
          severity: 'high',
          confidence: 'high',
          title: 'jwt.verify() called without specifying algorithms',
          description: `\`jwt.verify()\` at line ${lineNumber} does not specify which algorithms to accept, making it vulnerable to algorithm confusion attacks.`,
          explanation: 'Without specifying the `algorithms` option, an attacker may be able to exploit algorithm confusion vulnerabilities. For example, they could switch an RS256 token to HS256 and sign it with the public key, which the server would accept.',
          fixSuggestion: "Always specify the `algorithms` option in `jwt.verify()` (e.g., `{ algorithms: ['HS256'] }`). Never use `algorithms: ['none']`. Use `jwt.verify()` instead of `jwt.decode()` for authentication.",
          filePath: file.filePath,
          startLine: lineNumber,
          endLine: lineNumber,
          snippet,
          fingerprint: createFingerprint('insecure-jwt', file.filePath, snippet),
        })
        continue
      }

      if (JWT_DECODE.test(line)) {
        const hasVerifyInFile = /jwt\.verify\s*\(/.test(fullContent)
        const snippet = trimmed
        findings.push({
          ruleId: 'insecure-jwt',
          ruleVersion: 1,
          severity: hasVerifyInFile ? 'medium' : 'high',
          confidence: hasVerifyInFile ? 'medium' : 'high',
          title: 'jwt.decode() used instead of jwt.verify()',
          description: `\`jwt.decode()\` at line ${lineNumber} does not verify the token signature. ${hasVerifyInFile ? 'This file also uses jwt.verify(), so this may be intentional for non-auth purposes.' : 'Use jwt.verify() for authentication.'}`,
          explanation: '`jwt.decode()` only parses the token payload without verifying the signature. An attacker can create a token with any payload and it will be accepted. Always use `jwt.verify()` to ensure the token was issued by a trusted party.',
          fixSuggestion: "Always specify the `algorithms` option in `jwt.verify()` (e.g., `{ algorithms: ['HS256'] }`). Never use `algorithms: ['none']`. Use `jwt.verify()` instead of `jwt.decode()` for authentication.",
          filePath: file.filePath,
          startLine: lineNumber,
          endLine: lineNumber,
          snippet,
          fingerprint: createFingerprint('insecure-jwt', file.filePath, snippet),
        })
      }
    }

    return findings
  },
}

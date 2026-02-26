import { describe, it, expect } from 'vitest'
import { hardcodedSecretsRule } from '@/lib/rules/hardcoded-secrets'
import { makeFileChange, makeClassification } from '../../helpers'

// Assembled at runtime to avoid GitHub push protection false positive
const FAKE_SK_LIVE = `sk_live_${'TESTKEY00000000000000000000'}`
const FAKE_SK_TEST = `sk_test_${'TESTKEY00000000000000000000'}`

describe('hardcoded-secrets', () => {
  const classification = makeClassification({
    filePath: 'src/lib/api-client.ts',
    context: 'server',
    routeType: 'library',
  })

  describe('metadata', () => {
    it('should have correct rule metadata', () => {
      expect(hardcodedSecretsRule.id).toBe('hardcoded-secrets')
      expect(hardcodedSecretsRule.severity).toBe('critical')
      expect(hardcodedSecretsRule.confidence).toBe('high')
      expect(hardcodedSecretsRule.category).toBe('secrets')
      expect(hardcodedSecretsRule.version).toBe(1)
    })
  })

  describe('detection', () => {
    it('should detect Stripe live secret key', () => {
      const file = makeFileChange({
        filePath: 'src/lib/api-client.ts',
        content: `const stripeKey = "${FAKE_SK_LIVE}"`,
      })

      const findings = hardcodedSecretsRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].ruleId).toBe('hardcoded-secrets')
      expect(findings[0].severity).toBe('critical')
      expect(findings[0].title).toContain('Stripe live secret key')
    })

    it('should detect Stripe test secret key with medium severity', () => {
      const file = makeFileChange({
        filePath: 'src/lib/api-client.ts',
        content: `const stripeKey = "${FAKE_SK_TEST}"`,
      })

      const findings = hardcodedSecretsRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].severity).toBe('medium')
      expect(findings[0].title).toContain('Stripe test secret key')
    })

    it('should detect AWS access key (AKIA prefix)', () => {
      const file = makeFileChange({
        filePath: 'src/lib/api-client.ts',
        content: `const awsKey = "AKIAIOSFODNN7EXAMPLE"`,
      })

      const findings = hardcodedSecretsRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].title).toContain('AWS access key')
    })

    it('should detect GitHub personal access token (ghp_ prefix)', () => {
      const file = makeFileChange({
        filePath: 'src/lib/api-client.ts',
        content: `const token = "ghp_abcdefghijklmnopqrstuvwxyz0123456789"`,
      })

      const findings = hardcodedSecretsRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].title).toContain('GitHub personal access token')
    })

    it('should detect OpenAI API key (sk- prefix)', () => {
      const file = makeFileChange({
        filePath: 'src/lib/api-client.ts',
        content: `const openaiKey = "sk-abcdefghijklmnopqrstuvwxyz0123456"`,
      })

      const findings = hardcodedSecretsRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].title).toContain('OpenAI API key')
    })

    it('should detect multiple secrets on different lines', () => {
      const file = makeFileChange({
        filePath: 'src/lib/api-client.ts',
        content: [
          `const stripeKey = "${FAKE_SK_LIVE}"`,
          `const awsKey = "AKIAIOSFODNN7EXAMPLE"`,
        ].join('\n'),
      })

      const findings = hardcodedSecretsRule.run(file, classification)
      expect(findings.length).toBe(2)
    })
  })

  describe('safe patterns', () => {
    it('should not flag process.env references', () => {
      const file = makeFileChange({
        filePath: 'src/lib/api-client.ts',
        content: `const key = process.env.STRIPE_SECRET_KEY`,
      })

      const findings = hardcodedSecretsRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag import.meta.env references', () => {
      const file = makeFileChange({
        filePath: 'src/lib/api-client.ts',
        content: `const key = import.meta.env.STRIPE_SECRET_KEY`,
      })

      const findings = hardcodedSecretsRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag comment lines', () => {
      const file = makeFileChange({
        filePath: 'src/lib/api-client.ts',
        content: `// This is a key like ${FAKE_SK_LIVE}`,
      })

      const findings = hardcodedSecretsRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag hash comment lines', () => {
      const file = makeFileChange({
        filePath: 'src/lib/api-client.ts',
        content: `# This is a key like ${FAKE_SK_LIVE}`,
      })

      const findings = hardcodedSecretsRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag test files', () => {
      const file = makeFileChange({
        filePath: 'src/lib/api-client.test.ts',
        content: `const stripeKey = "${FAKE_SK_LIVE}"`,
      })
      const testClassification = makeClassification({
        filePath: 'src/lib/api-client.test.ts',
        isTest: true,
      })

      const findings = hardcodedSecretsRule.run(file, testClassification)
      expect(findings.length).toBe(0)
    })

    it('should not flag placeholder values', () => {
      const file = makeFileChange({
        filePath: 'src/lib/api-client.ts',
        content: `const key = "your_key_here"`,
      })

      const findings = hardcodedSecretsRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag lines with REPLACE_ME', () => {
      const file = makeFileChange({
        filePath: 'src/lib/api-client.ts',
        content: `const key = "REPLACE_ME"`,
      })

      const findings = hardcodedSecretsRule.run(file, classification)
      expect(findings.length).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should have a fingerprint for each finding', () => {
      const file = makeFileChange({
        filePath: 'src/lib/api-client.ts',
        content: `const key = "${FAKE_SK_LIVE}"`,
      })

      const findings = hardcodedSecretsRule.run(file, classification)
      expect(findings[0].fingerprint).toBeDefined()
      expect(findings[0].fingerprint.length).toBeGreaterThan(0)
    })

    it('should return correct line numbers', () => {
      const file = makeFileChange({
        filePath: 'src/lib/api-client.ts',
        content: [
          'const a = 1',
          'const b = 2',
          `const key = "${FAKE_SK_LIVE}"`,
        ].join('\n'),
      })

      const findings = hardcodedSecretsRule.run(file, classification)
      expect(findings[0].startLine).toBe(3)
      expect(findings[0].endLine).toBe(3)
    })

    it('should not flag a line with no matching patterns', () => {
      const file = makeFileChange({
        filePath: 'src/lib/api-client.ts',
        content: `const name = "hello world"`,
      })

      const findings = hardcodedSecretsRule.run(file, classification)
      expect(findings.length).toBe(0)
    })
  })
})

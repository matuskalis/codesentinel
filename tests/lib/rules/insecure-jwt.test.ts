import { describe, it, expect } from 'vitest'
import { insecureJwtRule } from '@/lib/rules/insecure-jwt'
import { makeFileChange, makeClassification } from '../../helpers'

describe('insecure-jwt', () => {
  const classification = makeClassification({
    filePath: 'src/lib/auth.ts',
    language: 'typescript',
    context: 'server',
    routeType: 'library',
  })

  describe('metadata', () => {
    it('should have correct rule metadata', () => {
      expect(insecureJwtRule.id).toBe('insecure-jwt')
      expect(insecureJwtRule.severity).toBe('high')
      expect(insecureJwtRule.confidence).toBe('high')
      expect(insecureJwtRule.category).toBe('auth')
      expect(insecureJwtRule.version).toBe(1)
    })
  })

  describe('detection', () => {
    it('should detect jwt.verify() without algorithms option', () => {
      const file = makeFileChange({
        filePath: 'src/lib/auth.ts',
        content: `const decoded = jwt.verify(token, secret)`,
      })

      const findings = insecureJwtRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].ruleId).toBe('insecure-jwt')
      expect(findings[0].title).toContain('without specifying algorithms')
    })

    it('should detect algorithms: ["none"] configuration', () => {
      const file = makeFileChange({
        filePath: 'src/lib/auth.ts',
        content: `const decoded = jwt.verify(token, secret, { algorithms: ['none'] })`,
      })

      const findings = insecureJwtRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].title).toContain('"none" algorithm')
    })

    it('should detect jwt.decode() used without jwt.verify() in same file', () => {
      const file = makeFileChange({
        filePath: 'src/lib/auth.ts',
        content: `const payload = jwt.decode(token)`,
      })

      const findings = insecureJwtRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].title).toContain('jwt.decode()')
      expect(findings[0].severity).toBe('high')
    })

    it('should detect jwt.decode() with lower severity when jwt.verify is also present', () => {
      const file = makeFileChange({
        filePath: 'src/lib/auth.ts',
        content: [
          `const verified = jwt.verify(token, secret, { algorithms: ['HS256'] })`,
          `const peek = jwt.decode(otherToken)`,
        ].join('\n'),
      })

      const findings = insecureJwtRule.run(file, classification)
      const decodeFindings = findings.filter(f => f.title.includes('jwt.decode()'))
      expect(decodeFindings.length).toBe(1)
      expect(decodeFindings[0].severity).toBe('medium')
      expect(decodeFindings[0].confidence).toBe('medium')
    })
  })

  describe('safe patterns', () => {
    it('should not flag jwt.verify() with algorithms option', () => {
      const file = makeFileChange({
        filePath: 'src/lib/auth.ts',
        content: `const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] })`,
      })

      const findings = insecureJwtRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag jwt.verify() with algorithms on nearby lines (context window)', () => {
      const file = makeFileChange({
        filePath: 'src/lib/auth.ts',
        content: [
          `const decoded = jwt.verify(token, secret, {`,
          `  algorithms: ['HS256'],`,
          `})`,
        ].join('\n'),
      })

      const findings = insecureJwtRule.run(file, classification)
      const verifyFindings = findings.filter(f => f.title.includes('without specifying algorithms'))
      expect(verifyFindings.length).toBe(0)
    })

    it('should not flag test files', () => {
      const file = makeFileChange({
        filePath: 'src/lib/auth.test.ts',
        content: `const decoded = jwt.verify(token, secret)`,
      })
      const testCls = makeClassification({
        filePath: 'src/lib/auth.test.ts',
        isTest: true,
      })

      const findings = insecureJwtRule.run(file, testCls)
      expect(findings.length).toBe(0)
    })

    it('should not flag comment lines', () => {
      const file = makeFileChange({
        filePath: 'src/lib/auth.ts',
        content: `// jwt.verify(token, secret) needs algorithms`,
      })

      const findings = insecureJwtRule.run(file, classification)
      expect(findings.length).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should return correct line numbers', () => {
      const file = makeFileChange({
        filePath: 'src/lib/auth.ts',
        content: [
          'import jwt from "jsonwebtoken"',
          '',
          'const decoded = jwt.verify(token, secret)',
        ].join('\n'),
      })

      const findings = insecureJwtRule.run(file, classification)
      expect(findings[0].startLine).toBe(3)
    })

    it('should have a fingerprint', () => {
      const file = makeFileChange({
        filePath: 'src/lib/auth.ts',
        content: `const decoded = jwt.verify(token, secret)`,
      })

      const findings = insecureJwtRule.run(file, classification)
      expect(findings[0].fingerprint).toBeDefined()
      expect(findings[0].fingerprint.length).toBeGreaterThan(0)
    })

    it('should not flag lines without JWT patterns', () => {
      const file = makeFileChange({
        filePath: 'src/lib/auth.ts',
        content: `const token = "some-bearer-token"`,
      })

      const findings = insecureJwtRule.run(file, classification)
      expect(findings.length).toBe(0)
    })
  })
})

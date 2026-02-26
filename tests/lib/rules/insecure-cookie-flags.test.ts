import { describe, it, expect } from 'vitest'
import { insecureCookieFlagsRule } from '@/lib/rules/insecure-cookie-flags'
import { makeFileChange, makeClassification } from '../../helpers'

describe('insecure-cookie-flags', () => {
  const classification = makeClassification({
    filePath: 'src/app/api/auth/login/route.ts',
    language: 'typescript',
    framework: 'nextjs',
    context: 'server',
    routeType: 'api-route',
  })

  describe('metadata', () => {
    it('should have correct rule metadata', () => {
      expect(insecureCookieFlagsRule.id).toBe('insecure-cookie-flags')
      expect(insecureCookieFlagsRule.severity).toBe('medium')
      expect(insecureCookieFlagsRule.confidence).toBe('high')
      expect(insecureCookieFlagsRule.category).toBe('auth')
      expect(insecureCookieFlagsRule.version).toBe(1)
    })
  })

  describe('detection', () => {
    it('should detect session cookie without httpOnly, secure, sameSite', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/auth/login/route.ts',
        content: [
          `cookies().set('session', token, {`,
          `  path: '/',`,
          `  maxAge: 3600,`,
          `})`,
        ].join('\n'),
      })

      const findings = insecureCookieFlagsRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].ruleId).toBe('insecure-cookie-flags')
      expect(findings[0].severity).toBe('medium')
      expect(findings[0].title).toContain('httpOnly')
      expect(findings[0].title).toContain('secure')
      expect(findings[0].title).toContain('sameSite')
    })

    it('should detect auth cookie with httpOnly: false', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/auth/login/route.ts',
        content: [
          `cookies().set('auth', token, {`,
          `  httpOnly: false,`,
          `  secure: true,`,
          `  sameSite: 'lax',`,
          `})`,
        ].join('\n'),
      })

      const findings = insecureCookieFlagsRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].title).toContain('httpOnly')
    })

    it('should detect token cookie with secure: false', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/auth/login/route.ts',
        content: [
          `cookies().set('token', value, {`,
          `  httpOnly: true,`,
          `  secure: false,`,
          `  sameSite: 'lax',`,
          `})`,
        ].join('\n'),
      })

      const findings = insecureCookieFlagsRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].title).toContain('secure')
    })

    it('should detect session cookie missing sameSite only', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/auth/login/route.ts',
        content: [
          `cookies().set('session', token, {`,
          `  httpOnly: true,`,
          `  secure: true,`,
          `})`,
        ].join('\n'),
      })

      const findings = insecureCookieFlagsRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].title).toContain('sameSite')
      expect(findings[0].title).not.toContain('httpOnly')
      expect(findings[0].title).not.toContain('secure')
    })

    it('should detect setCookie call with auth cookie name', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/auth/login/route.ts',
        content: [
          `setCookie('session', token, {`,
          `  path: '/',`,
          `  maxAge: 3600,`,
          `})`,
        ].join('\n'),
      })

      const findings = insecureCookieFlagsRule.run(file, classification)
      expect(findings.length).toBe(1)
    })
  })

  describe('safe patterns', () => {
    it('should not flag cookie with all security flags', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/auth/login/route.ts',
        content: [
          `cookies().set('session', token, {`,
          `  httpOnly: true,`,
          `  secure: true,`,
          `  sameSite: 'lax',`,
          `})`,
        ].join('\n'),
      })

      const findings = insecureCookieFlagsRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag non-auth cookies', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/auth/login/route.ts',
        content: [
          `cookies().set('theme', 'dark', {`,
          `  path: '/',`,
          `})`,
        ].join('\n'),
      })

      const findings = insecureCookieFlagsRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag test files', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/auth/login/route.test.ts',
        content: [
          `cookies().set('session', token, {`,
          `  path: '/',`,
          `})`,
        ].join('\n'),
      })
      const testCls = makeClassification({
        filePath: 'src/app/api/auth/login/route.test.ts',
        isTest: true,
      })

      const findings = insecureCookieFlagsRule.run(file, testCls)
      expect(findings.length).toBe(0)
    })

    it('should not flag comment lines', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/auth/login/route.ts',
        content: `// cookies().set('session', token)`,
      })

      const findings = insecureCookieFlagsRule.run(file, classification)
      expect(findings.length).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should return correct line number', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/auth/login/route.ts',
        content: [
          'export async function POST(req: Request) {',
          '  const token = "abc"',
          `  cookies().set('session', token, {`,
          `    path: '/',`,
          `  })`,
          '}',
        ].join('\n'),
      })

      const findings = insecureCookieFlagsRule.run(file, classification)
      expect(findings[0].startLine).toBe(3)
    })

    it('should have a fingerprint', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/auth/login/route.ts',
        content: [
          `cookies().set('session', token, {`,
          `  path: '/',`,
          `})`,
        ].join('\n'),
      })

      const findings = insecureCookieFlagsRule.run(file, classification)
      expect(findings[0].fingerprint).toBeDefined()
      expect(findings[0].fingerprint.length).toBeGreaterThan(0)
    })

    it('should not flag lines without cookie setters', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/auth/login/route.ts',
        content: `const token = generateToken()`,
      })

      const findings = insecureCookieFlagsRule.run(file, classification)
      expect(findings.length).toBe(0)
    })
  })
})

import { describe, it, expect } from 'vitest'
import { permissiveCorsRule } from '@/lib/rules/permissive-cors'
import { makeFileChange, makeClassification } from '../../helpers'

describe('permissive-cors', () => {
  const classification = makeClassification({
    filePath: 'src/app/api/data/route.ts',
    language: 'typescript',
    framework: 'nextjs',
    context: 'server',
    routeType: 'api-route',
  })

  describe('metadata', () => {
    it('should have correct rule metadata', () => {
      expect(permissiveCorsRule.id).toBe('permissive-cors')
      expect(permissiveCorsRule.severity).toBe('medium')
      expect(permissiveCorsRule.confidence).toBe('high')
      expect(permissiveCorsRule.category).toBe('api')
      expect(permissiveCorsRule.version).toBe(1)
    })
  })

  describe('detection', () => {
    it('should detect origin: "*" in config', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/data/route.ts',
        content: `const cors = { origin: '*' }`,
      })

      const findings = permissiveCorsRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].ruleId).toBe('permissive-cors')
      expect(findings[0].severity).toBe('medium')
    })

    it('should detect origin: "*" with double quotes', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/data/route.ts',
        content: `const cors = { origin: "*" }`,
      })

      const findings = permissiveCorsRule.run(file, classification)
      expect(findings.length).toBe(1)
    })

    it('should detect Access-Control-Allow-Origin header with wildcard', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/data/route.ts',
        content: `headers.set('Access-Control-Allow-Origin', '*')`,
      })

      const findings = permissiveCorsRule.run(file, classification)
      expect(findings.length).toBe(1)
    })

    it('should detect Access-Control-Allow-Origin header with double quotes', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/data/route.ts',
        content: `headers.set("Access-Control-Allow-Origin", "*")`,
      })

      const findings = permissiveCorsRule.run(file, classification)
      expect(findings.length).toBe(1)
    })
  })

  describe('safe patterns', () => {
    it('should not flag specific origin', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/data/route.ts',
        content: `const cors = { origin: 'https://example.com' }`,
      })

      const findings = permissiveCorsRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag test files', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/data/route.test.ts',
        content: `const cors = { origin: '*' }`,
      })
      const testCls = makeClassification({
        filePath: 'src/app/api/data/route.test.ts',
        routeType: 'api-route',
        isTest: true,
      })

      const findings = permissiveCorsRule.run(file, testCls)
      expect(findings.length).toBe(0)
    })

    it('should not flag comment lines', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/data/route.ts',
        content: `// origin: '*' is insecure`,
      })

      const findings = permissiveCorsRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag code without CORS patterns', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/data/route.ts',
        content: `const handler = async (req) => { return Response.json({}) }`,
      })

      const findings = permissiveCorsRule.run(file, classification)
      expect(findings.length).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should return correct line number', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/data/route.ts',
        content: [
          'export async function GET() {',
          '  const headers = new Headers()',
          '  headers.set("Access-Control-Allow-Origin", "*")',
          '  return new Response("ok", { headers })',
          '}',
        ].join('\n'),
      })

      const findings = permissiveCorsRule.run(file, classification)
      expect(findings[0].startLine).toBe(3)
    })

    it('should have a fingerprint', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/data/route.ts',
        content: `const cors = { origin: '*' }`,
      })

      const findings = permissiveCorsRule.run(file, classification)
      expect(findings[0].fingerprint).toBeDefined()
      expect(findings[0].fingerprint.length).toBeGreaterThan(0)
    })
  })
})

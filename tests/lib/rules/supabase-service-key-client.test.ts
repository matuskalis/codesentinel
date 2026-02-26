import { describe, it, expect } from 'vitest'
import { supabaseServiceKeyClientRule } from '@/lib/rules/supabase-service-key-client'
import { getRulesForFile } from '@/lib/rules'
import { makeFileChange, makeClassification } from '../../helpers'

describe('supabase-service-key-client', () => {
  const clientClassification = makeClassification({
    filePath: 'src/components/DataFetcher.tsx',
    language: 'typescript',
    framework: 'react',
    context: 'client',
    routeType: 'component',
  })

  describe('metadata', () => {
    it('should have correct rule metadata', () => {
      expect(supabaseServiceKeyClientRule.id).toBe('supabase-service-key-client')
      expect(supabaseServiceKeyClientRule.severity).toBe('critical')
      expect(supabaseServiceKeyClientRule.confidence).toBe('high')
      expect(supabaseServiceKeyClientRule.category).toBe('supabase')
      expect(supabaseServiceKeyClientRule.version).toBe(1)
    })
  })

  describe('detection', () => {
    it('should detect SUPABASE_SERVICE_ROLE_KEY in client code', () => {
      const file = makeFileChange({
        filePath: 'src/components/DataFetcher.tsx',
        content: `const key = process.env.SUPABASE_SERVICE_ROLE_KEY`,
      })

      const findings = supabaseServiceKeyClientRule.run(file, clientClassification)
      expect(findings.length).toBe(1)
      expect(findings[0].ruleId).toBe('supabase-service-key-client')
      expect(findings[0].severity).toBe('critical')
    })

    it('should detect service_role reference in client code', () => {
      const file = makeFileChange({
        filePath: 'src/components/DataFetcher.tsx',
        content: `const client = createClient(url, "service_role_key_here")`,
      })

      const findings = supabaseServiceKeyClientRule.run(file, clientClassification)
      expect(findings.length).toBe(1)
    })

    it('should detect supabaseServiceRoleKey variable in client code', () => {
      const file = makeFileChange({
        filePath: 'src/components/DataFetcher.tsx',
        content: `const supabaseServiceRoleKey = "abc123"`,
      })

      const findings = supabaseServiceKeyClientRule.run(file, clientClassification)
      expect(findings.length).toBe(1)
    })

    it('should detect serviceRole reference in client code', () => {
      const file = makeFileChange({
        filePath: 'src/components/DataFetcher.tsx',
        content: `const admin = createClient(url, key, { auth: { serviceRole: true } })`,
      })

      const findings = supabaseServiceKeyClientRule.run(file, clientClassification)
      expect(findings.length).toBe(1)
    })
  })

  describe('safe patterns', () => {
    it('should not apply to server-side code (via getRulesForFile filtering)', () => {
      // The rule's run() does not filter by context -- context filtering is done by
      // getRulesForFile() which checks applicableTo.contexts: ['client'].
      // Server context should NOT include this rule in the applicable rules list.
      const serverCls = makeClassification({
        filePath: 'src/app/api/data/route.ts',
        context: 'server',
        routeType: 'api-route',
      })

      const applicableRules = getRulesForFile(serverCls)
      const hasSupabaseRule = applicableRules.some(r => r.id === 'supabase-service-key-client')
      expect(hasSupabaseRule).toBe(false)
    })

    it('should not flag test files', () => {
      const file = makeFileChange({
        filePath: 'src/components/DataFetcher.test.tsx',
        content: `const key = process.env.SUPABASE_SERVICE_ROLE_KEY`,
      })
      const testCls = makeClassification({
        filePath: 'src/components/DataFetcher.test.tsx',
        context: 'client',
        isTest: true,
      })

      const findings = supabaseServiceKeyClientRule.run(file, testCls)
      expect(findings.length).toBe(0)
    })

    it('should not flag comment lines', () => {
      const file = makeFileChange({
        filePath: 'src/components/DataFetcher.tsx',
        content: `// Use SUPABASE_SERVICE_ROLE_KEY on the server only`,
      })

      const findings = supabaseServiceKeyClientRule.run(file, clientClassification)
      expect(findings.length).toBe(0)
    })

    it('should not flag code without service role references', () => {
      const file = makeFileChange({
        filePath: 'src/components/DataFetcher.tsx',
        content: `const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      })

      const findings = supabaseServiceKeyClientRule.run(file, clientClassification)
      expect(findings.length).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should report correct line number', () => {
      const file = makeFileChange({
        filePath: 'src/components/DataFetcher.tsx',
        content: [
          `'use client'`,
          '',
          `import { createClient } from '@supabase/supabase-js'`,
          '',
          `const key = process.env.SUPABASE_SERVICE_ROLE_KEY`,
        ].join('\n'),
      })

      const findings = supabaseServiceKeyClientRule.run(file, clientClassification)
      expect(findings[0].startLine).toBe(5)
    })

    it('should have a fingerprint', () => {
      const file = makeFileChange({
        filePath: 'src/components/DataFetcher.tsx',
        content: `const key = process.env.SUPABASE_SERVICE_ROLE_KEY`,
      })

      const findings = supabaseServiceKeyClientRule.run(file, clientClassification)
      expect(findings[0].fingerprint).toBeDefined()
      expect(findings[0].fingerprint.length).toBeGreaterThan(0)
    })

    it('should only match one pattern per line (break after first match)', () => {
      const file = makeFileChange({
        filePath: 'src/components/DataFetcher.tsx',
        content: `const SUPABASE_SERVICE_ROLE_KEY = service_role`,
      })

      const findings = supabaseServiceKeyClientRule.run(file, clientClassification)
      expect(findings.length).toBe(1)
    })
  })
})

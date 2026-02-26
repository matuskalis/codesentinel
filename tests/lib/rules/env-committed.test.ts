import { describe, it, expect } from 'vitest'
import { envCommittedRule } from '@/lib/rules/env-committed'
import { makeFileChange, makeClassification } from '../../helpers'

describe('env-committed', () => {
  const classification = makeClassification({
    filePath: '.env',
    language: 'env',
    context: 'config',
    routeType: 'config',
  })

  describe('metadata', () => {
    it('should have correct rule metadata', () => {
      expect(envCommittedRule.id).toBe('env-committed')
      expect(envCommittedRule.severity).toBe('critical')
      expect(envCommittedRule.confidence).toBe('high')
      expect(envCommittedRule.category).toBe('secrets')
      expect(envCommittedRule.version).toBe(2)
    })
  })

  describe('detection', () => {
    it('should detect .env file with real values', () => {
      const file = makeFileChange({
        filePath: '.env',
        status: 'added',
        content: [
          'DATABASE_URL=postgres://user:pass@localhost:5432/db',
          'STRIPE_SECRET_KEY=sk_live_abc123',
        ].join('\n'),
      })

      const findings = envCommittedRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].ruleId).toBe('env-committed')
      expect(findings[0].severity).toBe('critical')
    })

    it('should detect .env.local with real values', () => {
      const file = makeFileChange({
        filePath: '.env.local',
        status: 'modified',
        content: 'SECRET_KEY=my-real-secret-value',
      })
      const cls = makeClassification({
        filePath: '.env.local',
        language: 'env',
        context: 'config',
      })

      const findings = envCommittedRule.run(file, cls)
      expect(findings.length).toBe(1)
    })

    it('should detect .env.production with real values', () => {
      const file = makeFileChange({
        filePath: '.env.production',
        status: 'added',
        content: 'API_KEY=real_value_here',
      })
      const cls = makeClassification({
        filePath: '.env.production',
        language: 'env',
        context: 'config',
      })

      const findings = envCommittedRule.run(file, cls)
      expect(findings.length).toBe(1)
    })
  })

  describe('safe patterns', () => {
    it('should not flag .env.example files', () => {
      const file = makeFileChange({
        filePath: '.env.example',
        status: 'added',
        content: 'DATABASE_URL=postgres://user:pass@localhost:5432/db',
      })
      const cls = makeClassification({
        filePath: '.env.example',
        language: 'env',
        context: 'config',
      })

      const findings = envCommittedRule.run(file, cls)
      expect(findings.length).toBe(0)
    })

    it('should not flag .env.sample files', () => {
      const file = makeFileChange({
        filePath: '.env.sample',
        status: 'added',
        content: 'DATABASE_URL=postgres://user:pass@localhost:5432/db',
      })
      const cls = makeClassification({
        filePath: '.env.sample',
        language: 'env',
        context: 'config',
      })

      const findings = envCommittedRule.run(file, cls)
      expect(findings.length).toBe(0)
    })

    it('should not flag .env.template files', () => {
      const file = makeFileChange({
        filePath: '.env.template',
        status: 'added',
        content: 'DATABASE_URL=postgres://user:pass@localhost:5432/db',
      })
      const cls = makeClassification({
        filePath: '.env.template',
        language: 'env',
        context: 'config',
      })

      const findings = envCommittedRule.run(file, cls)
      expect(findings.length).toBe(0)
    })

    it('should not flag .env files with only empty values', () => {
      const file = makeFileChange({
        filePath: '.env',
        status: 'added',
        content: [
          'DATABASE_URL=',
          'STRIPE_SECRET_KEY=',
          'API_KEY=""',
          "ANOTHER_KEY=''",
        ].join('\n'),
      })

      const findings = envCommittedRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag .env files with only comments', () => {
      const file = makeFileChange({
        filePath: '.env',
        status: 'added',
        content: [
          '# This is a comment',
          '# DATABASE_URL=real_value',
          '',
        ].join('\n'),
      })

      const findings = envCommittedRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag deleted files', () => {
      const file = makeFileChange({
        filePath: '.env',
        status: 'deleted',
        content: 'SECRET_KEY=real_value',
      })

      const findings = envCommittedRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag .env files with only placeholder values', () => {
      const file = makeFileChange({
        filePath: '.env',
        status: 'added',
        content: [
          'NEXT_PUBLIC_SUPABASE_URL=your-project-url',
          'NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key',
          'STRIPE_SECRET_KEY=sk_test_xxx',
          'STRIPE_WEBHOOK_SECRET=whsec_xxx',
        ].join('\n'),
      })

      const findings = envCommittedRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag .env files with only localhost URLs and empty values', () => {
      const file = makeFileChange({
        filePath: '.env.development',
        status: 'added',
        content: [
          'NEXT_PUBLIC_APP_URL=http://localhost:3000',
          'NEXT_PUBLIC_API_URL=http://localhost:8083/api',
          'NEXT_PUBLIC_SUPABASE_ANON_KEY=',
          'STRIPE_SECRET_KEY=',
        ].join('\n'),
      })
      const cls = makeClassification({
        filePath: '.env.development',
        language: 'env',
        context: 'config',
      })

      const findings = envCommittedRule.run(file, cls)
      expect(findings.length).toBe(0)
    })

    it('should not flag .env files where sensitive vars have URL values only', () => {
      const file = makeFileChange({
        filePath: '.env.production',
        status: 'added',
        content: [
          'NEXT_PUBLIC_BINANCE_ACCESS_TOKEN_URI=https://accounts.binance.com/oauth/token/',
          'NEXT_PUBLIC_APP_URL=https://myapp.com',
          'STRIPE_SECRET_KEY=',
        ].join('\n'),
      })
      const cls = makeClassification({
        filePath: '.env.production',
        language: 'env',
        context: 'config',
      })

      const findings = envCommittedRule.run(file, cls)
      expect(findings.length).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should set startLine to 1 and endLine to last line', () => {
      const file = makeFileChange({
        filePath: '.env',
        status: 'added',
        content: [
          'SECRET_KEY=real_value_one',
          'API_TOKEN=real_value_two',
          'DB_PASSWORD=real_value_three',
        ].join('\n'),
      })

      const findings = envCommittedRule.run(file, classification)
      expect(findings[0].startLine).toBe(1)
      expect(findings[0].endLine).toBe(3)
    })

    it('should have a fingerprint', () => {
      const file = makeFileChange({
        filePath: '.env',
        status: 'added',
        content: 'SECRET=value',
      })

      const findings = envCommittedRule.run(file, classification)
      expect(findings[0].fingerprint).toBeDefined()
      expect(findings[0].fingerprint.length).toBeGreaterThan(0)
    })

    it('should not flag renamed files (status renamed)', () => {
      const file = makeFileChange({
        filePath: '.env',
        status: 'renamed',
        content: 'SECRET=value',
      })

      const findings = envCommittedRule.run(file, classification)
      expect(findings.length).toBe(0)
    })
  })
})

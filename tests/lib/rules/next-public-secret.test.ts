import { describe, it, expect } from 'vitest'
import { nextPublicSecretRule } from '@/lib/rules/next-public-secret'
import { makeFileChange, makeClassification } from '../../helpers'

describe('next-public-secret', () => {
  const classification = makeClassification({
    filePath: '.env.local',
    language: 'env',
    context: 'config',
    routeType: 'config',
  })

  describe('metadata', () => {
    it('should have correct rule metadata', () => {
      expect(nextPublicSecretRule.id).toBe('next-public-secret')
      expect(nextPublicSecretRule.severity).toBe('high')
      expect(nextPublicSecretRule.confidence).toBe('high')
      expect(nextPublicSecretRule.category).toBe('nextjs')
      expect(nextPublicSecretRule.version).toBe(1)
    })
  })

  describe('detection', () => {
    it('should detect NEXT_PUBLIC_ with SECRET suffix', () => {
      const file = makeFileChange({
        filePath: '.env.local',
        content: 'NEXT_PUBLIC_SECRET_KEY=real_secret_value_here',
      })

      const findings = nextPublicSecretRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].ruleId).toBe('next-public-secret')
      expect(findings[0].severity).toBe('high')
    })

    it('should detect NEXT_PUBLIC_ with TOKEN suffix', () => {
      const file = makeFileChange({
        filePath: '.env.local',
        content: 'NEXT_PUBLIC_AUTH_TOKEN=abc123realtoken',
      })

      const findings = nextPublicSecretRule.run(file, classification)
      expect(findings.length).toBe(1)
    })

    it('should detect NEXT_PUBLIC_ with PASSWORD suffix', () => {
      const file = makeFileChange({
        filePath: '.env.local',
        content: 'NEXT_PUBLIC_DB_PASSWORD=supersecretpassword',
      })

      const findings = nextPublicSecretRule.run(file, classification)
      expect(findings.length).toBe(1)
    })

    it('should detect NEXT_PUBLIC_ with PRIVATE suffix', () => {
      const file = makeFileChange({
        filePath: '.env.local',
        content: 'NEXT_PUBLIC_PRIVATE_KEY=real_private_key_value',
      })

      const findings = nextPublicSecretRule.run(file, classification)
      expect(findings.length).toBe(1)
    })

    it('should detect NEXT_PUBLIC_ with KEY suffix', () => {
      const file = makeFileChange({
        filePath: '.env.local',
        content: 'NEXT_PUBLIC_API_KEY=real_api_key_value',
      })

      const findings = nextPublicSecretRule.run(file, classification)
      expect(findings.length).toBe(1)
    })
  })

  describe('safe patterns', () => {
    it('should not flag NEXT_PUBLIC_ variables without secret suffixes', () => {
      const file = makeFileChange({
        filePath: '.env.local',
        content: 'NEXT_PUBLIC_API_URL=https://api.example.com',
      })

      const findings = nextPublicSecretRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag .env.example files', () => {
      const file = makeFileChange({
        filePath: '.env.example',
        content: 'NEXT_PUBLIC_SECRET_KEY=real_secret_value',
      })
      const cls = makeClassification({
        filePath: '.env.example',
        language: 'env',
        context: 'config',
      })

      const findings = nextPublicSecretRule.run(file, cls)
      expect(findings.length).toBe(0)
    })

    it('should not flag .env.sample files', () => {
      const file = makeFileChange({
        filePath: '.env.sample',
        content: 'NEXT_PUBLIC_SECRET_KEY=real_secret_value',
      })
      const cls = makeClassification({
        filePath: '.env.sample',
        language: 'env',
        context: 'config',
      })

      const findings = nextPublicSecretRule.run(file, cls)
      expect(findings.length).toBe(0)
    })

    it('should not flag empty values', () => {
      const file = makeFileChange({
        filePath: '.env.local',
        content: 'NEXT_PUBLIC_SECRET_KEY=',
      })

      const findings = nextPublicSecretRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag placeholder values', () => {
      const file = makeFileChange({
        filePath: '.env.local',
        content: 'NEXT_PUBLIC_SECRET_KEY=your_key_here',
      })

      const findings = nextPublicSecretRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag quoted empty values', () => {
      const file = makeFileChange({
        filePath: '.env.local',
        content: [
          'NEXT_PUBLIC_SECRET_KEY=""',
          "NEXT_PUBLIC_API_TOKEN=''",
        ].join('\n'),
      })

      const findings = nextPublicSecretRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag comment lines', () => {
      const file = makeFileChange({
        filePath: '.env.local',
        content: '# NEXT_PUBLIC_SECRET_KEY=real_value',
      })

      const findings = nextPublicSecretRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag NEXT_PUBLIC_SUPABASE_ANON_KEY', () => {
      const file = makeFileChange({
        filePath: '.env.local',
        content: 'NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc123',
      })

      const findings = nextPublicSecretRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', () => {
      const file = makeFileChange({
        filePath: '.env.local',
        content: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_abc123def456',
      })

      const findings = nextPublicSecretRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag Stripe publishable key values (pk_test_)', () => {
      const file = makeFileChange({
        filePath: '.env.local',
        content: 'NEXT_PUBLIC_STRIPE_PUBLIC_KEY_TEST=pk_test_51JB5XCabc123def456',
      })

      const findings = nextPublicSecretRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag Stripe publishable key values (pk_live_)', () => {
      const file = makeFileChange({
        filePath: '.env.local',
        content: 'NEXT_PUBLIC_STRIPE_KEY=pk_live_abc123def456ghi789',
      })

      const findings = nextPublicSecretRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag URL values', () => {
      const file = makeFileChange({
        filePath: '.env.local',
        content: 'NEXT_PUBLIC_AUTH_TOKEN_URI=https://accounts.example.com/oauth/token/',
      })

      const findings = nextPublicSecretRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag NEXT_PUBLIC_CLOUDINARY_API_KEY', () => {
      const file = makeFileChange({
        filePath: '.env.local',
        content: 'NEXT_PUBLIC_CLOUDINARY_API_KEY=683459535699771',
      })

      const findings = nextPublicSecretRule.run(file, classification)
      expect(findings.length).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should report correct line number', () => {
      const file = makeFileChange({
        filePath: '.env.local',
        content: [
          'NEXT_PUBLIC_API_URL=https://api.example.com',
          '',
          'NEXT_PUBLIC_SECRET_KEY=real_secret_value',
        ].join('\n'),
      })

      const findings = nextPublicSecretRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].startLine).toBe(3)
    })

    it('should have a fingerprint', () => {
      const file = makeFileChange({
        filePath: '.env.local',
        content: 'NEXT_PUBLIC_SECRET_KEY=real_secret_value',
      })

      const findings = nextPublicSecretRule.run(file, classification)
      expect(findings[0].fingerprint).toBeDefined()
      expect(findings[0].fingerprint.length).toBeGreaterThan(0)
    })
  })
})

import { describe, it, expect } from 'vitest'
import { sqlInjectionRule } from '@/lib/rules/sql-injection'
import { makeFileChange, makeClassification } from '../../helpers'

describe('sql-injection', () => {
  const classification = makeClassification({
    filePath: 'src/lib/db/queries.ts',
    language: 'typescript',
    context: 'server',
    routeType: 'library',
  })

  describe('metadata', () => {
    it('should have correct rule metadata', () => {
      expect(sqlInjectionRule.id).toBe('sql-injection')
      expect(sqlInjectionRule.severity).toBe('critical')
      expect(sqlInjectionRule.confidence).toBe('high')
      expect(sqlInjectionRule.category).toBe('api')
      expect(sqlInjectionRule.version).toBe(1)
    })
  })

  describe('detection', () => {
    it('should detect SQL with template literal interpolation', () => {
      const file = makeFileChange({
        filePath: 'src/lib/db/queries.ts',
        content: 'const query = `SELECT * FROM users WHERE id = ${userId}`',
      })

      const findings = sqlInjectionRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].ruleId).toBe('sql-injection')
      expect(findings[0].severity).toBe('critical')
    })

    it('should detect INSERT with template literal interpolation', () => {
      const file = makeFileChange({
        filePath: 'src/lib/db/queries.ts',
        content: 'const query = `INSERT INTO users (name) VALUES (${name})`',
      })

      const findings = sqlInjectionRule.run(file, classification)
      expect(findings.length).toBe(1)
    })

    it('should detect DELETE with template literal interpolation', () => {
      const file = makeFileChange({
        filePath: 'src/lib/db/queries.ts',
        content: 'const query = `DELETE FROM users WHERE id = ${id}`',
      })

      const findings = sqlInjectionRule.run(file, classification)
      expect(findings.length).toBe(1)
    })

    it('should detect SQL with string concatenation', () => {
      const file = makeFileChange({
        filePath: 'src/lib/db/queries.ts',
        content: `const query = "SELECT * FROM users WHERE name = " + userName`,
      })

      const findings = sqlInjectionRule.run(file, classification)
      expect(findings.length).toBe(1)
    })

    it('should detect SQL with reverse string concatenation', () => {
      const file = makeFileChange({
        filePath: 'src/lib/db/queries.ts',
        content: `const query = userId + " SELECT * FROM users"`,
      })

      const findings = sqlInjectionRule.run(file, classification)
      expect(findings.length).toBe(1)
    })
  })

  describe('safe patterns', () => {
    it('should not flag parameterized queries ($1)', () => {
      const file = makeFileChange({
        filePath: 'src/lib/db/queries.ts',
        content: `const query = "SELECT * FROM users WHERE id = $1"`,
      })

      const findings = sqlInjectionRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag ORM tagged templates (sql`...`)', () => {
      const file = makeFileChange({
        filePath: 'src/lib/db/queries.ts',
        content: 'const query = sql`SELECT * FROM users WHERE id = ${userId}`',
      })

      const findings = sqlInjectionRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag Prisma tagged templates', () => {
      const file = makeFileChange({
        filePath: 'src/lib/db/queries.ts',
        content: 'const query = Prisma.sql`SELECT * FROM users WHERE id = ${userId}`',
      })

      const findings = sqlInjectionRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag test files', () => {
      const file = makeFileChange({
        filePath: 'src/lib/db/queries.test.ts',
        content: 'const query = `SELECT * FROM users WHERE id = ${userId}`',
      })
      const testCls = makeClassification({
        filePath: 'src/lib/db/queries.test.ts',
        isTest: true,
      })

      const findings = sqlInjectionRule.run(file, testCls)
      expect(findings.length).toBe(0)
    })

    it('should not flag comment lines', () => {
      const file = makeFileChange({
        filePath: 'src/lib/db/queries.ts',
        content: '// const query = `SELECT * FROM users WHERE id = ${userId}`',
      })

      const findings = sqlInjectionRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag parameterized queries with ?', () => {
      const file = makeFileChange({
        filePath: 'src/lib/db/queries.ts',
        content: `const query = "SELECT * FROM users WHERE id = ?"`,
      })

      const findings = sqlInjectionRule.run(file, classification)
      expect(findings.length).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should return correct line number', () => {
      const file = makeFileChange({
        filePath: 'src/lib/db/queries.ts',
        content: [
          'import { db } from "./client"',
          '',
          'const query = `SELECT * FROM users WHERE id = ${userId}`',
        ].join('\n'),
      })

      const findings = sqlInjectionRule.run(file, classification)
      expect(findings[0].startLine).toBe(3)
    })

    it('should have a fingerprint', () => {
      const file = makeFileChange({
        filePath: 'src/lib/db/queries.ts',
        content: 'const query = `SELECT * FROM users WHERE id = ${userId}`',
      })

      const findings = sqlInjectionRule.run(file, classification)
      expect(findings[0].fingerprint).toBeDefined()
      expect(findings[0].fingerprint.length).toBeGreaterThan(0)
    })
  })
})

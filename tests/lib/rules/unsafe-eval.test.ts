import { describe, it, expect } from 'vitest'
import { unsafeEvalRule } from '@/lib/rules/unsafe-eval'
import { makeFileChange, makeClassification } from '../../helpers'

describe('unsafe-eval', () => {
  const classification = makeClassification({
    filePath: 'src/lib/utils.ts',
    language: 'typescript',
    context: 'server',
    routeType: 'library',
  })

  describe('metadata', () => {
    it('should have correct rule metadata', () => {
      expect(unsafeEvalRule.id).toBe('unsafe-eval')
      expect(unsafeEvalRule.severity).toBe('high')
      expect(unsafeEvalRule.confidence).toBe('high')
      expect(unsafeEvalRule.category).toBe('api')
      expect(unsafeEvalRule.version).toBe(1)
    })
  })

  describe('detection', () => {
    it('should detect eval() call', () => {
      const file = makeFileChange({
        filePath: 'src/lib/utils.ts',
        content: `const result = eval(userInput)`,
      })

      const findings = unsafeEvalRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].ruleId).toBe('unsafe-eval')
      expect(findings[0].severity).toBe('high')
      expect(findings[0].title).toContain('eval()')
    })

    it('should detect new Function() with variable argument', () => {
      const file = makeFileChange({
        filePath: 'src/lib/utils.ts',
        content: `const fn = new Function(userCode)`,
      })

      const findings = unsafeEvalRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].title).toContain('new Function()')
    })

    it('should detect child_process.exec with template literal interpolation', () => {
      const file = makeFileChange({
        filePath: 'src/lib/utils.ts',
        content: 'child_process.exec(`ls -la ${userDir}` + extra)',
      })

      const findings = unsafeEvalRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].title).toContain('child_process.exec()')
    })

    it('should detect execSync with string concatenation', () => {
      const file = makeFileChange({
        filePath: 'src/lib/utils.ts',
        content: `execSync("ls " + userPath)`,
      })

      const findings = unsafeEvalRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].title).toContain('execSync()')
    })
  })

  describe('safe patterns', () => {
    it('should not flag comment lines mentioning eval', () => {
      const file = makeFileChange({
        filePath: 'src/lib/utils.ts',
        content: `// Never use eval(userInput) in production`,
      })

      const findings = unsafeEvalRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag new Function() with string literal argument', () => {
      const file = makeFileChange({
        filePath: 'src/lib/utils.ts',
        content: `const fn = new Function('return 42')`,
      })

      const findings = unsafeEvalRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag test files', () => {
      const file = makeFileChange({
        filePath: 'src/lib/utils.test.ts',
        content: `const result = eval(userInput)`,
      })
      const testCls = makeClassification({
        filePath: 'src/lib/utils.test.ts',
        isTest: true,
      })

      const findings = unsafeEvalRule.run(file, testCls)
      expect(findings.length).toBe(0)
    })

    it('should not flag block comment lines', () => {
      const file = makeFileChange({
        filePath: 'src/lib/utils.ts',
        content: `/* eval(something) is dangerous */`,
      })

      const findings = unsafeEvalRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag child_process.exec without dynamic content', () => {
      const file = makeFileChange({
        filePath: 'src/lib/utils.ts',
        content: `child_process.exec("ls -la")`,
      })

      const findings = unsafeEvalRule.run(file, classification)
      expect(findings.length).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should return correct line number', () => {
      const file = makeFileChange({
        filePath: 'src/lib/utils.ts',
        content: [
          'import something from "module"',
          '',
          'const result = eval(userInput)',
        ].join('\n'),
      })

      const findings = unsafeEvalRule.run(file, classification)
      expect(findings[0].startLine).toBe(3)
    })

    it('should have a fingerprint', () => {
      const file = makeFileChange({
        filePath: 'src/lib/utils.ts',
        content: `const result = eval(userInput)`,
      })

      const findings = unsafeEvalRule.run(file, classification)
      expect(findings[0].fingerprint).toBeDefined()
      expect(findings[0].fingerprint.length).toBeGreaterThan(0)
    })

    it('should not flag lines without eval patterns', () => {
      const file = makeFileChange({
        filePath: 'src/lib/utils.ts',
        content: `const result = evaluate(input)`,
      })

      const findings = unsafeEvalRule.run(file, classification)
      expect(findings.length).toBe(0)
    })
  })
})

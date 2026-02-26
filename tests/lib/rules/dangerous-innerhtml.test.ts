import { describe, it, expect } from 'vitest'
import { dangerousInnerHtmlRule } from '@/lib/rules/dangerous-innerhtml'
import { makeFileChange, makeClassification } from '../../helpers'

describe('dangerous-innerhtml', () => {
  const classification = makeClassification({
    filePath: 'src/components/RichText.tsx',
    language: 'typescript',
    framework: 'react',
    context: 'client',
    routeType: 'component',
  })

  describe('metadata', () => {
    it('should have correct rule metadata', () => {
      expect(dangerousInnerHtmlRule.id).toBe('dangerous-innerhtml')
      expect(dangerousInnerHtmlRule.severity).toBe('high')
      expect(dangerousInnerHtmlRule.confidence).toBe('medium')
      expect(dangerousInnerHtmlRule.category).toBe('nextjs')
      expect(dangerousInnerHtmlRule.version).toBe(1)
    })
  })

  describe('detection', () => {
    it('should detect dangerouslySetInnerHTML with a variable', () => {
      const file = makeFileChange({
        filePath: 'src/components/RichText.tsx',
        content: `<div dangerouslySetInnerHTML={{ __html: userContent }} />`,
      })

      const findings = dangerousInnerHtmlRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].ruleId).toBe('dangerous-innerhtml')
      expect(findings[0].severity).toBe('high')
    })

    it('should detect dangerouslySetInnerHTML with a function call', () => {
      const file = makeFileChange({
        filePath: 'src/components/RichText.tsx',
        content: `<div dangerouslySetInnerHTML={{ __html: getData() }} />`,
      })

      const findings = dangerousInnerHtmlRule.run(file, classification)
      expect(findings.length).toBe(1)
    })

    it('should detect dangerouslySetInnerHTML with a property access', () => {
      const file = makeFileChange({
        filePath: 'src/components/RichText.tsx',
        content: `<div dangerouslySetInnerHTML={{ __html: props.html }} />`,
      })

      const findings = dangerousInnerHtmlRule.run(file, classification)
      expect(findings.length).toBe(1)
    })
  })

  describe('safe patterns', () => {
    it('should not flag dangerouslySetInnerHTML with a string literal (single quotes)', () => {
      const file = makeFileChange({
        filePath: 'src/components/RichText.tsx',
        content: `<div dangerouslySetInnerHTML={{ __html: '<br />' }} />`,
      })

      const findings = dangerousInnerHtmlRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag dangerouslySetInnerHTML with a string literal (double quotes)', () => {
      const file = makeFileChange({
        filePath: 'src/components/RichText.tsx',
        content: `<div dangerouslySetInnerHTML={{ __html: "<p>Hello</p>" }} />`,
      })

      const findings = dangerousInnerHtmlRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag test files', () => {
      const file = makeFileChange({
        filePath: 'src/components/RichText.test.tsx',
        content: `<div dangerouslySetInnerHTML={{ __html: userContent }} />`,
      })
      const testCls = makeClassification({
        filePath: 'src/components/RichText.test.tsx',
        isTest: true,
      })

      const findings = dangerousInnerHtmlRule.run(file, testCls)
      expect(findings.length).toBe(0)
    })

    it('should not flag comment lines', () => {
      const file = makeFileChange({
        filePath: 'src/components/RichText.tsx',
        content: `// <div dangerouslySetInnerHTML={{ __html: userContent }} />`,
      })

      const findings = dangerousInnerHtmlRule.run(file, classification)
      expect(findings.length).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should return correct line number', () => {
      const file = makeFileChange({
        filePath: 'src/components/RichText.tsx',
        content: [
          'const Component = () => {',
          '  return (',
          '    <div dangerouslySetInnerHTML={{ __html: content }} />',
          '  )',
          '}',
        ].join('\n'),
      })

      const findings = dangerousInnerHtmlRule.run(file, classification)
      expect(findings[0].startLine).toBe(3)
    })

    it('should have a fingerprint', () => {
      const file = makeFileChange({
        filePath: 'src/components/RichText.tsx',
        content: `<div dangerouslySetInnerHTML={{ __html: userContent }} />`,
      })

      const findings = dangerousInnerHtmlRule.run(file, classification)
      expect(findings[0].fingerprint).toBeDefined()
      expect(findings[0].fingerprint.length).toBeGreaterThan(0)
    })

    it('should not flag lines without dangerouslySetInnerHTML', () => {
      const file = makeFileChange({
        filePath: 'src/components/RichText.tsx',
        content: `<div className="content">{children}</div>`,
      })

      const findings = dangerousInnerHtmlRule.run(file, classification)
      expect(findings.length).toBe(0)
    })
  })
})

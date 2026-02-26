import type { RuleDefinition, RuleFinding } from '@/types'
import { createFingerprint } from './fingerprint'

interface EvalPattern {
  regex: RegExp
  label: string
}

const EVAL_PATTERNS: EvalPattern[] = [
  { regex: /\beval\s*\(/, label: 'eval()' },
  { regex: /new\s+Function\s*\(/, label: 'new Function()' },
  { regex: /child_process\.exec\s*\(/, label: 'child_process.exec()' },
  { regex: /\bexecSync\s*\(/, label: 'execSync()' },
]

const EXEC_TEMPLATE_LITERAL = /(?:child_process\.exec|execSync|child_process\.spawn)\s*\([^)]*`[^`]*\$\{/
const NEW_FUNCTION_STRING_LITERAL = /new\s+Function\s*\(\s*(['"])/

export const unsafeEvalRule: RuleDefinition = {
  id: 'unsafe-eval',
  name: 'Unsafe Code Evaluation',
  description: 'Detects usage of eval(), new Function(), and unsanitized child process execution.',
  severity: 'high',
  confidence: 'high',
  category: 'api',
  tags: ['injection', 'eval'],
  version: 1,
  applicableTo: {
    languages: ['typescript', 'javascript'],
  },

  run(file, classification) {
    const findings: RuleFinding[] = []

    if (classification.isTest) return findings

    const lines = file.content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNumber = i + 1
      const trimmed = line.trim()

      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue

      for (const pattern of EVAL_PATTERNS) {
        if (!pattern.regex.test(line)) continue

        if (pattern.label === 'new Function()' && NEW_FUNCTION_STRING_LITERAL.test(line)) continue

        if ((pattern.label === 'child_process.exec()' || pattern.label === 'execSync()') && !EXEC_TEMPLATE_LITERAL.test(line)) {
          if (!/`[^`]*\$\{/.test(line) && !/\+\s*\w+/.test(line)) continue
        }

        const snippet = trimmed
        findings.push({
          ruleId: 'unsafe-eval',
          ruleVersion: 1,
          severity: 'high',
          confidence: 'high',
          title: `Unsafe ${pattern.label} usage detected`,
          description: `\`${pattern.label}\` is used at line ${lineNumber}, which can execute arbitrary code.`,
          explanation: `\`${pattern.label}\` executes arbitrary code at runtime. If any part of the input is user-controlled, an attacker can execute malicious code on the server, potentially gaining full system access.`,
          fixSuggestion: 'Avoid `eval()` and `new Function()`. For child processes, use `execFile()` or `spawn()` with argument arrays instead of interpolated command strings.',
          filePath: file.filePath,
          startLine: lineNumber,
          endLine: lineNumber,
          snippet,
          fingerprint: createFingerprint('unsafe-eval', file.filePath, snippet),
        })

        break
      }
    }

    return findings
  },
}

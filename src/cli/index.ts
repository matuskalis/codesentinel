process.env.LOG_LEVEL = 'silent'

import * as path from 'node:path'
import * as fs from 'node:fs'
import { buildFileChanges } from './walker.js'
import { formatTerminal, formatJson, formatFailMessage, formatPassMessage } from './formatter.js'
import { runScan } from '@/lib/scanner'
import { DIRECTORY_SCAN_LIMITS } from '@/lib/scan-limits'
import type { Severity } from '@/types'

const VERSION = '0.1.0'

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

interface CliOptions {
  command: string | null
  directory: string
  json: boolean
  failOn: Severity
  quiet: boolean
  version: boolean
  help: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2)
  const options: CliOptions = {
    command: null,
    directory: '.',
    json: false,
    failOn: 'high',
    quiet: false,
    version: false,
    help: false,
  }

  let i = 0
  while (i < args.length) {
    const arg = args[i]

    if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg === '--version' || arg === '-v') {
      options.version = true
    } else if (arg === '--json') {
      options.json = true
    } else if (arg === '--quiet' || arg === '-q') {
      options.quiet = true
    } else if (arg === '--fail-on') {
      i++
      const value = args[i]
      if (!value || !['critical', 'high', 'medium', 'low'].includes(value)) {
        process.stderr.write(`Error: --fail-on requires one of: critical, high, medium, low\n`)
        process.exit(2)
      }
      options.failOn = value as Severity
    } else if (arg === '--') {
      // Skip separator
    } else if (arg.startsWith('--')) {
      process.stderr.write(`Unknown option: ${arg}\n`)
      process.exit(2)
    } else if (!options.command) {
      options.command = arg
    } else {
      options.directory = arg
    }

    i++
  }

  return options
}

function displayPath(absoluteDir: string): string {
  const relativeDir = path.relative(process.cwd(), absoluteDir)
  if (relativeDir.startsWith('..') || path.isAbsolute(relativeDir)) return absoluteDir
  return relativeDir || '.'
}

function printHelp(): void {
  const help = `
CodeSentinel v${VERSION}, preflight security gate

Usage:
  codesentinel scan [directory]    Scan a directory for security issues
  codesentinel --version           Print version
  codesentinel --help              Print this help

Options:
  --json              Output results as JSON
  --fail-on <level>   Fail threshold: critical, high, medium, low (default: high)
                      Only high-confidence findings block, except with low
  --quiet             Suppress output, exit code only

Exit codes:
  0  no blocking findings
  1  blocking findings
  2  usage error

Examples:
  codesentinel scan .
  codesentinel scan ./my-project --json
  codesentinel scan . --fail-on critical --quiet
`
  process.stdout.write(help.trimStart())
}

function shouldFail(
  findings: { severity: Severity; confidence: string }[],
  failOn: Severity
): number {
  const threshold = SEVERITY_ORDER[failOn]

  if (failOn === 'low') {
    return findings.length
  }

  return findings.filter(f =>
    SEVERITY_ORDER[f.severity] >= threshold && f.confidence === 'high'
  ).length
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv)

  if (options.version) {
    process.stdout.write(`codesentinel v${VERSION}\n`)
    return
  }

  if (options.help) {
    printHelp()
    return
  }

  if (options.command !== 'scan') {
    if (options.command) {
      process.stderr.write(`Unknown command: ${options.command}\n\n`)
    }
    printHelp()
    process.exit(options.command ? 2 : 0)
  }

  const absoluteDir = path.resolve(options.directory)

  if (!fs.existsSync(absoluteDir)) {
    process.stderr.write(`Error: directory not found: ${absoluteDir}\n`)
    process.exit(2)
  }

  const files = buildFileChanges(absoluteDir)
  const result = await runScan(files, [], DIRECTORY_SCAN_LIMITS)

  if (options.json && !options.quiet) {
    process.stdout.write(formatJson(result) + '\n')
  } else if (!options.quiet) {
    process.stdout.write(formatTerminal(result, displayPath(absoluteDir), VERSION) + '\n')
  }

  const failCount = shouldFail(result.findings, options.failOn)

  if (!options.quiet && !options.json) {
    if (failCount > 0) {
      process.stdout.write(formatFailMessage(failCount, options.failOn) + '\n')
    } else {
      process.stdout.write(formatPassMessage(result.findings.length) + '\n')
    }
    process.stdout.write('\n')
  }

  if (failCount > 0) {
    process.exit(1)
  }
}

main().catch(err => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(2)
})

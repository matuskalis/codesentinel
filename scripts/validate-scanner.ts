import * as fs from 'node:fs'
import * as path from 'node:path'
import { runScan } from '@/lib/scanner'
import type { FileChange } from '@/types'
import { shouldSkipFile, DEFAULT_SCAN_LIMITS } from '@/lib/scan-limits'

const MAX_FILE_BYTES = 512 * 1024

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.yml', '.yaml'])
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.git', 'coverage'])

function isEnvFile(name: string): boolean {
  return name === '.env' || name.startsWith('.env.')
}

function walkDir(dir: string): string[] {
  const results: string[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath))
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name)
      if (SCAN_EXTENSIONS.has(ext) || isEnvFile(entry.name)) {
        results.push(fullPath)
      }
    }
  }
  return results
}

function buildFileChange(filePath: string, relativePath: string): FileChange | null {
  try {
    const stat = fs.statSync(filePath)
    if (stat.size > MAX_FILE_BYTES) return null
    const content = fs.readFileSync(filePath, 'utf-8')
    const lineCount = content.split('\n').length
    return { filePath: relativePath, status: 'added', content, additions: [{ start: 1, end: lineCount }], deletions: [] }
  } catch {
    return null
  }
}

async function main() {
  const targetDir = process.argv[2]
  if (!targetDir) {
    process.stderr.write('Usage: npx tsx scripts/validate-scanner.ts /path/to/repo\n')
    process.exit(1)
  }

  const resolvedDir = path.resolve(targetDir)
  if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
    process.stderr.write(`Error: "${resolvedDir}" is not a valid directory\n`)
    process.exit(1)
  }

  process.stderr.write(`Scanning: ${resolvedDir}\n`)

  const allPaths = walkDir(resolvedDir)
  const files: FileChange[] = []
  let skipped = 0

  for (const absPath of allPaths) {
    const rel = path.relative(resolvedDir, absPath)
    if (shouldSkipFile(rel, DEFAULT_SCAN_LIMITS)) {
      skipped++
      continue
    }
    const fc = buildFileChange(absPath, rel)
    if (!fc) {
      skipped++
      continue
    }
    files.push(fc)
  }

  process.stderr.write(`Found ${files.length} scannable files (${skipped} skipped)\n`)

  const result = await runScan(files, [])

  const byRule: Record<string, number> = {}
  for (const f of result.findings) {
    byRule[f.ruleId] = (byRule[f.ruleId] ?? 0) + 1
  }

  const output = {
    repo: resolvedDir,
    filesScanned: result.summary.filesScanned,
    filesSkipped: skipped,
    totalFindings: result.summary.totalFindings,
    findings: result.findings.map(f => ({
      ruleId: f.ruleId,
      severity: f.severity,
      confidence: f.confidence,
      title: f.title,
      filePath: f.filePath,
      startLine: f.startLine,
      endLine: f.endLine,
      snippet: f.snippet,
      fingerprint: f.fingerprint,
    })),
    byRule,
    riskScore: result.riskScore,
    riskLevel: result.riskLevel,
    scanDurationMs: result.summary.scanDurationMs,
  }

  process.stdout.write(JSON.stringify(output, null, 2) + '\n')

  const log = (msg: string) => process.stderr.write(msg + '\n')
  log('\n--- Summary ---')
  log(`Files scanned: ${result.summary.filesScanned}`)
  log(`Files skipped: ${skipped}`)
  log(`Rules applied: ${result.summary.rulesApplied}`)
  log(`Total findings: ${result.summary.totalFindings}`)
  log(`Risk score: ${result.riskScore}/100 (${result.riskLevel})`)
  log(`Duration: ${result.summary.scanDurationMs}ms`)

  if (result.findings.length > 0) {
    log('\nFindings by rule:')
    for (const [ruleId, count] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) log(`  ${ruleId}: ${count}`)
    log('\nTop findings:')
    for (const f of result.findings.slice(0, 10)) log(`  [${f.severity}] ${f.title} - ${f.filePath}:${f.startLine}`)
  } else {
    log('\nNo findings detected.')
  }
}

main().catch(err => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})

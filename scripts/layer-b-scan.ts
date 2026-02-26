import * as fs from 'node:fs'
import * as path from 'node:path'
import { execSync } from 'node:child_process'
import { runScan } from '@/lib/scanner'
import type { FileChange } from '@/types'
import { shouldSkipFile, DEFAULT_SCAN_LIMITS } from '@/lib/scan-limits'

const MAX_FILE_BYTES = 512 * 1024
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.yml', '.yaml'])
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.git', 'coverage', '.turbo', '.vercel'])

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

function countLOC(dir: string): number {
  const files = walkDir(dir)
  let total = 0
  for (const f of files) {
    try {
      const content = fs.readFileSync(f, 'utf-8')
      total += content.split('\n').length
    } catch { /* skip */ }
  }
  return total
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

interface RepoResult {
  repo: string
  bucket: string
  stars: number | null
  lastPushed: string | null
  loc: number
  filesScanned: number
  filesSkipped: number
  totalFindings: number
  findings: {
    ruleId: string
    severity: string
    confidence: string
    filePath: string
    startLine: number
    endLine: number
    snippet: string
    label: string
    actionable: string
  }[]
  scanDurationMs: number
  cloneError: string | null
}

async function cloneAndScan(repoFullName: string, bucket: string, cloneDir: string): Promise<RepoResult> {
  const repoDir = path.join(cloneDir, repoFullName.replace('/', '__'))
  const result: RepoResult = {
    repo: repoFullName,
    bucket,
    stars: null,
    lastPushed: null,
    loc: 0,
    filesScanned: 0,
    filesSkipped: 0,
    totalFindings: 0,
    findings: [],
    scanDurationMs: 0,
    cloneError: null,
  }

  // Clone if not already present
  if (!fs.existsSync(repoDir)) {
    try {
      execSync(`git clone --depth=1 --quiet https://github.com/${repoFullName}.git "${repoDir}"`, {
        timeout: 60000,
        stdio: 'pipe',
      })
    } catch (err) {
      result.cloneError = err instanceof Error ? err.message : String(err)
      return result
    }
  }

  // Get repo metadata
  try {
    const metaJson = execSync(`gh repo view ${repoFullName} --json stargazerCount,pushedAt`, {
      timeout: 15000,
      stdio: 'pipe',
    }).toString()
    const meta = JSON.parse(metaJson)
    result.stars = meta.stargazerCount ?? null
    result.lastPushed = meta.pushedAt?.slice(0, 10) ?? null
  } catch { /* skip metadata */ }

  // Walk and build file changes
  const allPaths = walkDir(repoDir)
  const files: FileChange[] = []
  let skipped = 0

  for (const absPath of allPaths) {
    const rel = path.relative(repoDir, absPath)
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

  result.loc = countLOC(repoDir)
  result.filesSkipped = skipped

  // Scan
  const scanResult = await runScan(files, [])
  result.filesScanned = scanResult.summary.filesScanned
  result.totalFindings = scanResult.summary.totalFindings
  result.scanDurationMs = scanResult.summary.scanDurationMs

  result.findings = scanResult.findings.map(f => ({
    ruleId: f.ruleId,
    severity: f.severity,
    confidence: f.confidence,
    filePath: f.filePath,
    startLine: f.startLine,
    endLine: f.endLine,
    snippet: f.snippet.slice(0, 120),
    label: '',       // to be filled manually: TP / FP / unsure
    actionable: '',  // to be filled manually: yes / no
  }))

  return result
}

async function main() {
  const reposFile = path.resolve('layer-b-repos.json')
  const reposData = JSON.parse(fs.readFileSync(reposFile, 'utf-8'))
  const cloneDir = path.resolve('layer-b-repos')
  const outputDir = path.resolve('layer-b-results')

  fs.mkdirSync(cloneDir, { recursive: true })
  fs.mkdirSync(outputDir, { recursive: true })

  const buckets: [string, string[]][] = [
    ['bucket_1_swamp_tutorials', reposData.bucket_1_swamp_tutorials],
    ['bucket_2_hackathon_unfinished', reposData.bucket_2_hackathon_unfinished],
    ['bucket_3_incident_signals', reposData.bucket_3_incident_signals],
  ]

  const allResults: RepoResult[] = []
  let processed = 0
  const total = buckets.reduce((s, [, repos]) => s + repos.length, 0)

  for (const [bucket, repos] of buckets) {
    process.stderr.write(`\n=== ${bucket} (${repos.length} repos) ===\n`)

    for (const repo of repos) {
      processed++
      process.stderr.write(`[${processed}/${total}] ${repo}...`)

      const result = await cloneAndScan(repo, bucket, cloneDir)
      allResults.push(result)

      if (result.cloneError) {
        process.stderr.write(` CLONE FAILED\n`)
      } else {
        process.stderr.write(` ${result.filesScanned} files, ${result.totalFindings} findings\n`)
      }

      // Save individual result
      const safeFilename = repo.replace('/', '__') + '.json'
      fs.writeFileSync(
        path.join(outputDir, safeFilename),
        JSON.stringify(result, null, 2) + '\n'
      )
    }
  }

  // Summary
  const summary = {
    totalRepos: allResults.length,
    cloneFailures: allResults.filter(r => r.cloneError).length,
    successfulScans: allResults.filter(r => !r.cloneError).length,
    totalFindings: allResults.reduce((s, r) => s + r.totalFindings, 0),
    findingsByRule: {} as Record<string, number>,
    findingsByBucket: {} as Record<string, { repos: number, findings: number, reposWithFindings: number }>,
    repos: allResults.map(r => ({
      repo: r.repo,
      bucket: r.bucket,
      stars: r.stars,
      loc: r.loc,
      filesScanned: r.filesScanned,
      totalFindings: r.totalFindings,
      findingsByRule: r.findings.reduce((m, f) => {
        m[f.ruleId] = (m[f.ruleId] ?? 0) + 1
        return m
      }, {} as Record<string, number>),
    })),
  }

  for (const r of allResults) {
    const bk = r.bucket
    if (!summary.findingsByBucket[bk]) {
      summary.findingsByBucket[bk] = { repos: 0, findings: 0, reposWithFindings: 0 }
    }
    summary.findingsByBucket[bk].repos++
    summary.findingsByBucket[bk].findings += r.totalFindings
    if (r.totalFindings > 0) summary.findingsByBucket[bk].reposWithFindings++

    for (const f of r.findings) {
      summary.findingsByRule[f.ruleId] = (summary.findingsByRule[f.ruleId] ?? 0) + 1
    }
  }

  fs.writeFileSync(
    path.join(outputDir, '_summary.json'),
    JSON.stringify(summary, null, 2) + '\n'
  )

  // Print summary table
  const log = (msg: string) => process.stderr.write(msg + '\n')
  log('\n========== LAYER B SUMMARY ==========')
  log(`Repos scanned: ${summary.successfulScans} / ${summary.totalRepos}`)
  log(`Clone failures: ${summary.cloneFailures}`)
  log(`Total findings: ${summary.totalFindings}`)
  log('')
  log('Findings by rule:')
  for (const [rule, count] of Object.entries(summary.findingsByRule).sort((a, b) => b[1] - a[1])) {
    log(`  ${rule}: ${count}`)
  }
  log('')
  log('Findings by bucket:')
  for (const [bucket, data] of Object.entries(summary.findingsByBucket)) {
    log(`  ${bucket}: ${data.findings} findings in ${data.reposWithFindings}/${data.repos} repos`)
  }
  log('=====================================')

  // Also write the full results to stdout as JSON
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n')
}

main().catch(err => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})

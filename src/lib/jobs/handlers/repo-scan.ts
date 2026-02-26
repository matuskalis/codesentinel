import type { Job } from 'bullmq'
import type { RepoScanJobPayload, FileChange, InsertFindingDTO } from '@/types'
import { logger } from '@/lib/logger'
import { createScan, updateScanStatus, completeScan } from '@/lib/db/queries/scans'
import { bulkInsertFindings } from '@/lib/db/queries/findings'
import { getMutedRuleIds } from '@/lib/db/queries/muted-rules'
import { getFileContent } from '@/lib/github/api'
import { getInstallationOctokit } from '@/lib/github/client'
import { runScan } from '@/lib/scanner'
import { DEFAULT_SCAN_LIMITS, shouldSkipFile } from '@/lib/scan-limits'

export async function handleRepoScan(
  job: Job<RepoScanJobPayload>
): Promise<void> {
  const { data } = job
  const scanLogger = logger.child({
    jobId: job.id,
    repo: data.repositoryFullName,
    branch: data.branch,
    sha: data.commitSha,
  })

  // Step 1: Create scan record in DB
  const scan = await createScan({
    repoId: data.repoDbId,
    type: 'repo',
    commitSha: data.commitSha,
  })
  const scanId = scan.id

  try {
    // Step 2: Update scan status to 'scanning'
    scanLogger.info({ scanId }, 'Repo scan started')
    await updateScanStatus(scanId, 'scanning')

    const [owner, repo] = data.repositoryFullName.split('/')

    // Step 3: Fetch repository file tree via GitHub git tree API
    const octokit = await getInstallationOctokit(data.installationId)
    const treeResponse = await octokit.request(
      'GET /repos/{owner}/{repo}/git/trees/{tree_sha}',
      {
        owner,
        repo,
        tree_sha: data.commitSha,
        recursive: 'true',
      }
    )

    const treeData = treeResponse.data as {
      tree: Array<{
        path?: string
        type?: string
        size?: number
      }>
      truncated: boolean
    }

    if (treeData.truncated) {
      scanLogger.warn('Repository tree was truncated by GitHub API')
    }

    // Step 4: Filter files using scan limits
    const eligibleFiles = treeData.tree.filter((entry) => {
      if (entry.type !== 'blob') return false
      if (!entry.path) return false
      if (shouldSkipFile(entry.path)) return false
      if (
        entry.size !== undefined &&
        entry.size > DEFAULT_SCAN_LIMITS.maxBytesPerFile
      ) {
        return false
      }
      return true
    })

    const filesToScan = eligibleFiles.slice(
      0,
      DEFAULT_SCAN_LIMITS.maxFilesPerScan
    )

    scanLogger.info(
      {
        totalTree: treeData.tree.length,
        eligible: eligibleFiles.length,
        scanning: filesToScan.length,
      },
      'Filtered repository files'
    )

    // Step 5: Fetch file contents
    const CONCURRENCY = 10
    const fileChanges: FileChange[] = []

    for (let i = 0; i < filesToScan.length; i += CONCURRENCY) {
      const batch = filesToScan.slice(i, i + CONCURRENCY)

      const results = await Promise.all(
        batch.map(async (entry) => {
          const content = await getFileContent(
            data.installationId,
            owner,
            repo,
            entry.path!,
            data.commitSha
          )
          return {
            filePath: entry.path!,
            status: 'added' as const,
            content,
            additions: [],
            deletions: [],
          }
        })
      )

      fileChanges.push(...results)
    }

    scanLogger.info(
      { fileCount: fileChanges.length },
      'Fetched file contents'
    )

    // Step 6: Get muted rule IDs
    const mutedRuleIds = await getMutedRuleIds(data.repoDbId)

    // Step 7: Run scan
    const result = await runScan(fileChanges, mutedRuleIds)
    scanLogger.info(
      {
        findings: result.findings.length,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
      },
      'Scan completed'
    )

    // Step 8: Store findings
    if (result.findings.length > 0) {
      const findingDtos: InsertFindingDTO[] = result.findings.map((f) => ({
        scanId,
        repoId: data.repoDbId,
        ruleId: f.ruleId,
        ruleVersion: f.ruleVersion,
        severity: f.severity,
        confidence: f.confidence,
        title: f.title,
        description: f.description,
        explanation: f.explanation,
        fixSuggestion: f.fixSuggestion,
        filePath: f.filePath,
        startLine: f.startLine,
        endLine: f.endLine,
        snippet: f.snippet,
        fingerprint: f.fingerprint,
      }))

      await bulkInsertFindings(findingDtos)
    }

    // Step 9: Complete scan
    await completeScan(scanId, {
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      lastHeadSha: data.commitSha,
    })

    scanLogger.info({ scanId }, 'Repo scan completed successfully')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    scanLogger.error({ error: message, scanId }, 'Repo scan failed')

    try {
      await updateScanStatus(scanId, 'failed', message)
    } catch (dbError) {
      scanLogger.error(
        { dbError },
        'Failed to update scan status to failed'
      )
    }

    throw error
  }
}

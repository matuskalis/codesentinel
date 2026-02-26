import type { Job } from 'bullmq'
import type { PRScanJobPayload, InsertFindingDTO } from '@/types'
import { logger } from '@/lib/logger'
import { createScan, updateScanStatus, completeScan } from '@/lib/db/queries/scans'
import { bulkInsertFindings } from '@/lib/db/queries/findings'
import { getMutedRuleIds } from '@/lib/db/queries/muted-rules'
import { upsertPullRequest } from '@/lib/db/queries/pull-requests'
import { getPRDiff, getPRFiles, getFileContent } from '@/lib/github/api'
import { parseDiff } from '@/lib/scanner/diff-parser'
import { runScan } from '@/lib/scanner'
import { postScanResults } from '@/lib/reporting'
import { getEnv } from '@/lib/env'

export async function handlePRScan(
  job: Job<PRScanJobPayload>
): Promise<void> {
  const { data } = job
  const scanLogger = logger.child({
    jobId: job.id,
    repo: data.repositoryFullName,
    pr: data.prNumber,
    sha: data.headSha,
  })

  // Step 1: Create scan record in DB
  const scan = await createScan({
    repoId: data.repoDbId,
    type: 'pr',
    prNumber: data.prNumber,
    commitSha: data.headSha,
  })
  const scanId = scan.id

  try {
    // Step 2: Update scan status to 'scanning'
    scanLogger.info({ scanId }, 'PR scan started')
    await updateScanStatus(scanId, 'scanning')

    // Step 3: Upsert pull request record
    const pr = await upsertPullRequest({
      repoId: data.repoDbId,
      githubPrNumber: data.prNumber,
      headSha: data.headSha,
      baseSha: data.baseSha,
      title: `PR #${data.prNumber}`,
      authorLogin: 'unknown',
    })

    // Step 4: Fetch PR diff and files
    const [owner, repo] = data.repositoryFullName.split('/')
    const rawDiff = await getPRDiff(
      data.installationId,
      owner,
      repo,
      data.prNumber
    )
    scanLogger.info({ diffLength: rawDiff.length }, 'Fetched PR diff')

    // Step 5: Parse diff and build patch map for diff-position mapping
    const diffFiles = parseDiff(rawDiff)
    const prFiles = await getPRFiles(
      data.installationId,
      owner,
      repo,
      data.prNumber
    )

    const filePatchMap = new Map<string, string>()
    for (const f of prFiles) {
      if (f.patch) {
        filePatchMap.set(f.filename, f.patch)
      }
    }

    // Step 6: Fetch full content for each changed file (skip deleted)
    const filesWithContent = await Promise.all(
      diffFiles
        .filter((f) => f.status !== 'deleted')
        .map(async (file) => {
          const content = await getFileContent(
            data.installationId,
            owner,
            repo,
            file.filePath,
            data.headSha
          )
          return { ...file, content }
        })
    )

    scanLogger.info(
      { fileCount: filesWithContent.length },
      'Fetched file contents'
    )

    // Step 7: Get muted rule IDs
    const mutedRuleIds = await getMutedRuleIds(data.repoDbId)

    // Step 8: Run scan
    const result = await runScan(filesWithContent, mutedRuleIds)
    scanLogger.info(
      {
        findings: result.findings.length,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
      },
      'Scan completed'
    )

    // Step 9: Store findings
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

    // Step 10: Post results to PR
    const env = getEnv()
    const commentId = await postScanResults(
      {
        scanId,
        result,
        prNumber: data.prNumber,
        repoFullName: data.repositoryFullName,
        commitSha: data.headSha,
        dashboardUrl: env.NEXT_PUBLIC_APP_URL,
      },
      {
        installationId: data.installationId,
        owner,
        repo,
        pullRequestDbId: pr.id,
        filePatchMap,
      }
    )

    // Step 11: Complete scan
    await completeScan(scanId, {
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      summaryCommentId: commentId,
      lastHeadSha: data.headSha,
    })

    scanLogger.info({ scanId }, 'PR scan completed successfully')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    scanLogger.error({ error: message, scanId }, 'PR scan failed')

    try {
      await updateScanStatus(scanId, 'failed', message)
    } catch (dbError) {
      scanLogger.error({ dbError }, 'Failed to update scan status to failed')
    }

    throw error
  }
}

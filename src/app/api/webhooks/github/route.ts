import { NextRequest, NextResponse } from 'next/server'
import { getGitHubApp } from '@/lib/github/app'
import { setupWebhookHandlers } from '@/lib/github/webhooks'
import {
  upsertInstallation,
  deleteInstallation,
  getInstallationByGithubId,
} from '@/lib/db/queries/installations'
import { upsertRepository } from '@/lib/db/queries/repositories'
import { enqueuePRScan } from '@/lib/jobs/producer'
import { logger } from '@/lib/logger'

let handlersInitialized = false

function ensureHandlers() {
  if (handlersInitialized) return
  handlersInitialized = true

  setupWebhookHandlers({
    async onPROpened(data) {
      const installation = await getInstallationByGithubId(data.installationId)
      if (!installation) {
        logger.warn(
          { installationId: data.installationId },
          'Installation not found for PR webhook'
        )
        return
      }

      const repo = await upsertRepository({
        installationId: installation.id,
        githubRepoId: data.repositoryId,
        fullName: data.repositoryFullName,
        defaultBranch: data.defaultBranch,
      })

      await enqueuePRScan({
        installationId: data.installationId,
        repositoryFullName: data.repositoryFullName,
        repositoryId: data.repositoryId,
        repoDbId: repo.id,
        prNumber: data.prNumber,
        headSha: data.headSha,
        baseSha: data.baseSha,
      })
    },

    async onInstallationCreated(data) {
      const installation = await upsertInstallation({
        githubInstallationId: data.installationId,
        accountLogin: data.accountLogin,
        accountType: data.accountType,
      })

      for (const r of data.repositories) {
        await upsertRepository({
          installationId: installation.id,
          githubRepoId: r.id,
          fullName: r.fullName,
          defaultBranch: r.defaultBranch ?? 'main',
        })
      }
    },

    async onInstallationDeleted(data) {
      await deleteInstallation(data.installationId)
    },

    async onRepositoriesAdded(data) {
      const installation = await getInstallationByGithubId(data.installationId)
      if (!installation) return

      for (const r of data.repositories) {
        await upsertRepository({
          installationId: installation.id,
          githubRepoId: r.id,
          fullName: r.fullName,
          defaultBranch: r.defaultBranch ?? 'main',
        })
      }
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    ensureHandlers()

    const body = await request.text()
    const signature = request.headers.get('x-hub-signature-256') ?? ''
    const event = request.headers.get('x-github-event') ?? ''
    const deliveryId = request.headers.get('x-github-delivery') ?? ''

    const app = getGitHubApp()
    await app.webhooks.verifyAndReceive({
      id: deliveryId,
      name: event as Parameters<typeof app.webhooks.verifyAndReceive>[0]['name'],
      payload: body,
      signature,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('signature') ||
        error.message.includes('sign'))
    ) {
      logger.warn({ error }, 'Webhook signature verification failed')
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 400 }
      )
    }
    logger.error({ error }, 'Webhook processing failed')
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

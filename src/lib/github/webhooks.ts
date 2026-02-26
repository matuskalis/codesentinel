import { getGitHubApp } from './app'
import { logger } from '@/lib/logger'
import type { AccountType } from '@/types'

interface WebhookCallbacks {
  onPROpened: (data: {
    installationId: number
    repositoryId: number
    repositoryFullName: string
    defaultBranch: string
    prNumber: number
    headSha: string
    baseSha: string
    title: string
    authorLogin: string
  }) => Promise<void>

  onInstallationCreated: (data: {
    installationId: number
    accountLogin: string
    accountType: AccountType
    repositories: Array<{ id: number; fullName: string; defaultBranch?: string }>
  }) => Promise<void>

  onInstallationDeleted: (data: {
    installationId: number
  }) => Promise<void>

  onRepositoriesAdded: (data: {
    installationId: number
    repositories: Array<{ id: number; fullName: string; defaultBranch?: string }>
  }) => Promise<void>
}

export function setupWebhookHandlers(callbacks: WebhookCallbacks): void {
  const app = getGitHubApp()

  app.webhooks.on(
    ['pull_request.opened', 'pull_request.synchronize'],
    async ({ payload }) => {
      const installationId = payload.installation?.id
      if (!installationId) {
        logger.warn('PR webhook received without installation ID')
        return
      }

      logger.info(
        {
          event: 'pull_request',
          action: payload.action,
          repo: payload.repository.full_name,
          pr: payload.pull_request.number,
        },
        'PR webhook received'
      )

      await callbacks.onPROpened({
        installationId,
        repositoryId: payload.repository.id,
        repositoryFullName: payload.repository.full_name,
        defaultBranch: payload.repository.default_branch,
        prNumber: payload.pull_request.number,
        headSha: payload.pull_request.head.sha,
        baseSha: payload.pull_request.base.sha,
        title: payload.pull_request.title,
        authorLogin: payload.pull_request.user?.login ?? 'unknown',
      })
    }
  )

  app.webhooks.on('installation.created', async ({ payload }) => {
    const account = payload.installation.account
    const accountLogin =
      account && 'login' in account ? account.login : (account?.name ?? 'unknown')
    const accountType =
      account && 'type' in account
        ? (account.type.toLowerCase() as AccountType)
        : ('organization' as AccountType)

    logger.info(
      {
        event: 'installation.created',
        installationId: payload.installation.id,
        account: accountLogin,
      },
      'Installation created'
    )

    await callbacks.onInstallationCreated({
      installationId: payload.installation.id,
      accountLogin,
      accountType,
      repositories: (payload.repositories ?? []).map((r) => ({
        id: r.id,
        fullName: r.full_name,
      })),
    })
  })

  app.webhooks.on('installation.deleted', async ({ payload }) => {
    logger.info(
      {
        event: 'installation.deleted',
        installationId: payload.installation.id,
      },
      'Installation deleted'
    )

    await callbacks.onInstallationDeleted({
      installationId: payload.installation.id,
    })
  })

  app.webhooks.on('installation_repositories.added', async ({ payload }) => {
    const installationId = payload.installation.id

    logger.info(
      {
        event: 'installation_repositories.added',
        installationId,
        count: payload.repositories_added.length,
      },
      'Repositories added to installation'
    )

    await callbacks.onRepositoriesAdded({
      installationId,
      repositories: payload.repositories_added.map((r) => ({
        id: r.id,
        fullName: r.full_name,
      })),
    })
  })

  app.webhooks.onError((error) => {
    logger.error({ error: error.message }, 'Webhook handler error')
  })
}

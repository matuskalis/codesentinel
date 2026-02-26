import { App } from '@octokit/app'
import { getEnv } from '@/lib/env'

let app: App | null = null

export function getGitHubApp(): App {
  if (!app) {
    const env = getEnv()
    app = new App({
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_APP_PRIVATE_KEY,
      webhooks: {
        secret: env.GITHUB_APP_WEBHOOK_SECRET,
      },
    })
  }
  return app
}

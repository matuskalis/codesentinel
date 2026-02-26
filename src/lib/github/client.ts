import { getGitHubApp } from './app'

export async function getInstallationOctokit(installationId: number) {
  const app = getGitHubApp()
  return app.getInstallationOctokit(installationId)
}

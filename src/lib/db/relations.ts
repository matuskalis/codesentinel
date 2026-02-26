import { relations } from 'drizzle-orm'
import {
  users,
  sessions,
  githubInstallations,
  repositories,
  pullRequests,
  scans,
  findings,
  scanComments,
  mutedRules,
} from './schema'

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export const githubInstallationsRelations = relations(
  githubInstallations,
  ({ many }) => ({
    repositories: many(repositories),
  })
)

export const repositoriesRelations = relations(
  repositories,
  ({ one, many }) => ({
    installation: one(githubInstallations, {
      fields: [repositories.installationId],
      references: [githubInstallations.id],
    }),
    pullRequests: many(pullRequests),
    scans: many(scans),
    findings: many(findings),
    mutedRules: many(mutedRules),
  })
)

export const pullRequestsRelations = relations(
  pullRequests,
  ({ one, many }) => ({
    repository: one(repositories, {
      fields: [pullRequests.repoId],
      references: [repositories.id],
    }),
    scans: many(scans),
    scanComments: many(scanComments),
  })
)

export const scansRelations = relations(scans, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [scans.repoId],
    references: [repositories.id],
  }),
  pullRequest: one(pullRequests, {
    fields: [scans.pullRequestId],
    references: [pullRequests.id],
  }),
  findings: many(findings),
  scanComments: many(scanComments),
}))

export const findingsRelations = relations(findings, ({ one }) => ({
  scan: one(scans, {
    fields: [findings.scanId],
    references: [scans.id],
  }),
  repository: one(repositories, {
    fields: [findings.repoId],
    references: [repositories.id],
  }),
}))

export const scanCommentsRelations = relations(scanComments, ({ one }) => ({
  scan: one(scans, {
    fields: [scanComments.scanId],
    references: [scans.id],
    relationName: 'scanComment_scan',
  }),
  pullRequest: one(pullRequests, {
    fields: [scanComments.pullRequestId],
    references: [pullRequests.id],
  }),
  lastScan: one(scans, {
    fields: [scanComments.lastScanId],
    references: [scans.id],
    relationName: 'scanComment_lastScan',
  }),
}))

export const mutedRulesRelations = relations(mutedRules, ({ one }) => ({
  repository: one(repositories, {
    fields: [mutedRules.repoId],
    references: [repositories.id],
  }),
}))

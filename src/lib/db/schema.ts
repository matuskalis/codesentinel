import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core'

// === Enums ===

export const accountTypeEnum = pgEnum('account_type', ['user', 'organization'])
export const scanTypeEnum = pgEnum('scan_type', ['pr', 'repo'])
export const scanStatusEnum = pgEnum('scan_status', [
  'queued',
  'scanning',
  'completed',
  'failed',
])
export const findingStatusEnum = pgEnum('finding_status', [
  'open',
  'muted',
  'resolved',
])

// === Tables ===

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubId: integer('github_id').unique().notNull(),
  login: text('login').notNull(),
  email: text('email'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  tokenHash: text('token_hash').unique().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const githubInstallations = pgTable('github_installations', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubInstallationId: integer('github_installation_id').unique().notNull(),
  accountLogin: text('account_login').notNull(),
  accountType: accountTypeEnum('account_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const repositories = pgTable('repositories', {
  id: uuid('id').primaryKey().defaultRandom(),
  installationId: uuid('installation_id')
    .notNull()
    .references(() => githubInstallations.id),
  githubRepoId: integer('github_repo_id').unique().notNull(),
  fullName: text('full_name').notNull(),
  defaultBranch: text('default_branch').notNull().default('main'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const pullRequests = pgTable(
  'pull_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repoId: uuid('repo_id')
      .notNull()
      .references(() => repositories.id),
    githubPrNumber: integer('github_pr_number').notNull(),
    headSha: text('head_sha').notNull(),
    baseSha: text('base_sha').notNull(),
    title: text('title').notNull(),
    authorLogin: text('author_login').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique('pull_requests_repo_pr_unique').on(t.repoId, t.githubPrNumber)]
)

export const scans = pgTable('scans', {
  id: uuid('id').primaryKey().defaultRandom(),
  repoId: uuid('repo_id')
    .notNull()
    .references(() => repositories.id),
  pullRequestId: uuid('pull_request_id').references(() => pullRequests.id),
  type: scanTypeEnum('type').notNull(),
  commitSha: text('commit_sha').notNull(),
  status: scanStatusEnum('status').notNull().default('queued'),
  riskScore: integer('risk_score'),
  riskLevel: text('risk_level'),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const findings = pgTable('findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  scanId: uuid('scan_id')
    .notNull()
    .references(() => scans.id),
  repoId: uuid('repo_id')
    .notNull()
    .references(() => repositories.id),
  ruleId: text('rule_id').notNull(),
  ruleVersion: integer('rule_version').notNull(),
  severity: text('severity').notNull(),
  confidence: text('confidence').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  explanation: text('explanation').notNull(),
  fixSuggestion: text('fix_suggestion').notNull(),
  filePath: text('file_path').notNull(),
  startLine: integer('start_line').notNull(),
  endLine: integer('end_line').notNull(),
  snippet: text('snippet').notNull(),
  fingerprint: text('fingerprint').notNull(),
  status: findingStatusEnum('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const scanComments = pgTable(
  'scan_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scanId: uuid('scan_id')
      .notNull()
      .references(() => scans.id),
    pullRequestId: uuid('pull_request_id')
      .notNull()
      .references(() => pullRequests.id),
    githubCommentId: integer('github_comment_id').notNull(),
    lastHeadSha: text('last_head_sha').notNull(),
    lastScanId: uuid('last_scan_id')
      .notNull()
      .references(() => scans.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique('scan_comments_pr_unique').on(t.pullRequestId)]
)

export const mutedRules = pgTable(
  'muted_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repoId: uuid('repo_id')
      .notNull()
      .references(() => repositories.id),
    ruleId: text('rule_id').notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique('muted_rules_repo_rule_unique').on(t.repoId, t.ruleId)]
)

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: text('event_type').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

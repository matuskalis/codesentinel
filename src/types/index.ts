// === Enums ===
export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type Confidence = 'high' | 'medium' | 'low'
export type ScanStatus = 'queued' | 'scanning' | 'completed' | 'failed'
export type ScanType = 'pr' | 'repo'
export type FindingStatus = 'open' | 'muted' | 'resolved'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type AccountType = 'user' | 'organization'

// === File Classification ===
export interface FileClassification {
  filePath: string
  language: 'typescript' | 'javascript' | 'json' | 'yaml' | 'env' | 'other'
  framework: 'nextjs' | 'react' | 'node' | 'unknown'
  context: 'client' | 'server' | 'shared' | 'config' | 'unknown'
  routeType: 'api-route' | 'page' | 'component' | 'middleware' | 'library' | 'config' | 'none'
  isTest: boolean
}

// === Diff / File Change ===
export interface FileChange {
  filePath: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  content: string
  patch?: string
  additions: LineRange[]
  deletions: LineRange[]
}

export interface LineRange {
  start: number
  end: number
}

// === Rule Interface ===
export interface RuleDefinition {
  id: string
  name: string
  description: string
  severity: Severity
  confidence: Confidence
  category: 'secrets' | 'nextjs' | 'auth' | 'api' | 'supabase' | 'stripe' | 'ai'
  tags: string[]
  version: number
  applicableTo: {
    languages?: FileClassification['language'][]
    contexts?: FileClassification['context'][]
    routeTypes?: FileClassification['routeType'][]
    filePatterns?: string[]
  }
  run: (file: FileChange, classification: FileClassification) => RuleFinding[]
}

export interface RuleFinding {
  ruleId: string
  ruleVersion: number
  severity: Severity
  confidence: Confidence
  title: string
  description: string
  explanation: string
  fixSuggestion: string
  filePath: string
  startLine: number
  endLine: number
  snippet: string
  fingerprint: string
}

// === Scan Result ===
export interface ScanResult {
  findings: RuleFinding[]
  riskScore: number
  riskLevel: RiskLevel
  summary: ScanSummary
}

export interface ScanSummary {
  totalFindings: number
  bySeverity: Record<Severity, number>
  filesScanned: number
  rulesApplied: number
  scanDurationMs: number
}

// === Scan Limits Config ===
export interface ScanLimits {
  maxFilesPerScan: number
  maxBytesPerFile: number
  scanTimeoutMs: number
  ruleTimeoutMs: number
  skipPatterns: string[]
}

// === Job Payloads ===
export interface PRScanJobPayload {
  installationId: number
  repositoryFullName: string
  repositoryId: number
  repoDbId: string
  prNumber: number
  headSha: string
  baseSha: string
}

export interface RepoScanJobPayload {
  installationId: number
  repositoryFullName: string
  repositoryId: number
  repoDbId: string
  branch: string
  commitSha: string
}

// === DB Insert DTOs ===
export interface CreateScanDTO {
  repoId: string
  type: ScanType
  prNumber?: number
  commitSha: string
}

export interface InsertFindingDTO {
  scanId: string
  repoId: string
  ruleId: string
  ruleVersion: number
  severity: Severity
  confidence: Confidence
  title: string
  description: string
  explanation: string
  fixSuggestion: string
  filePath: string
  startLine: number
  endLine: number
  snippet: string
  fingerprint: string
}

export interface CompleteScanDTO {
  riskScore: number
  riskLevel: RiskLevel
  summaryCommentId?: number
  lastHeadSha: string
}

// === Dashboard API Response Types ===
export interface DashboardStats {
  totalRepos: number
  totalScans: number
  totalFindings: number
  avgRiskScore: number
  findingsBySeverity: Record<Severity, number>
}

export interface ScanListItem {
  id: string
  repoFullName: string
  type: ScanType
  prNumber: number | null
  status: ScanStatus
  riskScore: number | null
  riskLevel: RiskLevel | null
  totalFindings: number
  commitSha: string
  createdAt: Date
  completedAt: Date | null
}

export interface FindingListItem {
  id: string
  scanId: string
  ruleId: string
  ruleVersion: number
  severity: Severity
  confidence: Confidence
  title: string
  filePath: string
  startLine: number
  status: FindingStatus
  repoFullName: string
  createdAt: Date
}

// === Report Input Contract ===
export interface ReportInput {
  scanId: string
  result: ScanResult
  prNumber: number
  repoFullName: string
  commitSha: string
  dashboardUrl: string
  existingCommentId?: number
}

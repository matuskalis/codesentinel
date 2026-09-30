import type { ScanLimits } from '@/types'

export const DEFAULT_SCAN_LIMITS: ScanLimits = {
  maxFilesPerScan: 500,
  maxBytesPerFile: 512 * 1024, // 512KB
  scanTimeoutMs: 120_000,       // 2 minutes
  ruleTimeoutMs: 5_000,         // 5 seconds per rule
  skipPatterns: [
    'node_modules',
    '.next',
    'dist',
    'build',
    'coverage',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    '*.min.js',
    '*.min.css',
    '*.map',
    '*.woff',
    '*.woff2',
    '*.ttf',
    '*.eot',
    '*.png',
    '*.jpg',
    '*.jpeg',
    '*.gif',
    '*.svg',
    '*.ico',
    '*.mp4',
    '*.webm',
    '*.pdf',
    '*.zip',
    '*.tar',
    '*.gz',
  ],
}

const SCAN_TIMEOUT_ENV = 'CODESENTINEL_SCAN_TIMEOUT_MS'

function scanTimeoutFromEnv(env: Record<string, string | undefined>): number {
  const raw = env[SCAN_TIMEOUT_ENV]
  if (raw === undefined || raw === '') return DEFAULT_SCAN_LIMITS.scanTimeoutMs
  if (!/^\d+$/.test(raw)) throw new Error(`${SCAN_TIMEOUT_ENV} must be a whole number of milliseconds, got "${raw}"`)
  return Number(raw)
}

// A directory scan has no cost budget like a pull request scan, so it must not stop at 500 files.
// Its time limit can be raised (or lowered) through the environment.
export function directoryScanLimits(env: Record<string, string | undefined> = process.env): ScanLimits {
  return {
    ...DEFAULT_SCAN_LIMITS,
    maxFilesPerScan: Number.POSITIVE_INFINITY,
    scanTimeoutMs: scanTimeoutFromEnv(env),
  }
}

export function shouldSkipFile(filePath: string, limits: ScanLimits = DEFAULT_SCAN_LIMITS): boolean {
  const segments = filePath.split(/[\\/]/)
  const fileName = segments[segments.length - 1]

  return limits.skipPatterns.some(pattern => {
    if (pattern.startsWith('*.')) {
      return fileName.endsWith(pattern.slice(1))
    }
    return segments.includes(pattern)
  })
}

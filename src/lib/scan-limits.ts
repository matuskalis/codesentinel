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

export function shouldSkipFile(filePath: string, limits: ScanLimits = DEFAULT_SCAN_LIMITS): boolean {
  return limits.skipPatterns.some(pattern => {
    if (pattern.startsWith('*.')) {
      return filePath.endsWith(pattern.slice(1))
    }
    return filePath.includes(pattern)
  })
}

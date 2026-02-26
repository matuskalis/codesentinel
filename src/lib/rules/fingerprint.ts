import { createHash } from 'crypto'

export function createFingerprint(ruleId: string, filePath: string, snippet: string): string {
  const normalized = snippet.replace(/\s+/g, ' ').trim()
  return createHash('sha256').update(`${ruleId}:${filePath}:${normalized}`).digest('hex')
}

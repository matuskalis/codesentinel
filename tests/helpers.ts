import type { FileChange, FileClassification } from '@/types'

export function makeFileChange(
  overrides: Partial<FileChange> & { content: string; filePath: string }
): FileChange {
  return {
    status: 'added',
    patch: undefined,
    additions: [{ start: 1, end: overrides.content.split('\n').length }],
    deletions: [],
    ...overrides,
  }
}

export function makeClassification(
  overrides: Partial<FileClassification> & { filePath: string }
): FileClassification {
  return {
    language: 'typescript',
    framework: 'nextjs',
    context: 'server',
    routeType: 'library',
    isTest: false,
    ...overrides,
  }
}

import type { FileChange, LineRange } from '@/types'

export function parseDiff(rawDiff: string): FileChange[] {
  const files: FileChange[] = []
  const fileDiffs = rawDiff.split(/^diff --git /m).filter(Boolean)

  for (const fileDiff of fileDiffs) {
    const parsed = parseFileDiff(fileDiff)
    if (parsed) files.push(parsed)
  }

  return files
}

function parseFileDiff(fileDiff: string): FileChange | null {
  const lines = fileDiff.split('\n')

  // Extract file path from "a/path b/path" header
  const headerMatch = lines[0]?.match(/a\/(.*?) b\/(.*)/)
  if (!headerMatch) return null

  const oldPath = headerMatch[1]
  const newPath = headerMatch[2]

  // Skip binary files
  if (fileDiff.includes('Binary files')) return null
  if (fileDiff.includes('GIT binary patch')) return null

  // Determine status
  let status: FileChange['status'] = 'modified'
  if (fileDiff.includes('new file mode')) status = 'added'
  else if (fileDiff.includes('deleted file mode')) status = 'deleted'
  else if (fileDiff.includes('rename from') || oldPath !== newPath) status = 'renamed'

  // Extract patch (everything from first @@ onwards)
  const patchStart = fileDiff.indexOf('@@')
  const patch = patchStart >= 0 ? fileDiff.slice(patchStart) : undefined

  // Parse hunks for line ranges
  const additions: LineRange[] = []
  const deletions: LineRange[] = []

  if (patch) {
    parseHunks(patch, additions, deletions)
  }

  return {
    filePath: newPath,
    status,
    content: '',
    patch,
    additions,
    deletions,
  }
}

function parseHunks(patch: string, additions: LineRange[], deletions: LineRange[]): void {
  const lines = patch.split('\n')

  let currentNewLine = 0
  let currentOldLine = 0
  let addStart: number | null = null
  let delStart: number | null = null

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (hunkMatch) {
      // Flush any pending ranges
      if (addStart !== null) {
        additions.push({ start: addStart, end: currentNewLine - 1 })
        addStart = null
      }
      if (delStart !== null) {
        deletions.push({ start: delStart, end: currentOldLine - 1 })
        delStart = null
      }
      currentOldLine = parseInt(hunkMatch[1], 10)
      currentNewLine = parseInt(hunkMatch[2], 10)
      continue
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      if (addStart === null) addStart = currentNewLine
      currentNewLine++
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      if (delStart === null) delStart = currentOldLine
      currentOldLine++
      // Flush addition range if we were tracking one
      if (addStart !== null) {
        additions.push({ start: addStart, end: currentNewLine - 1 })
        addStart = null
      }
    } else if (line.startsWith('\\')) {
      // "No newline at end of file" marker — skip
      continue
    } else {
      // Context line
      if (addStart !== null) {
        additions.push({ start: addStart, end: currentNewLine - 1 })
        addStart = null
      }
      if (delStart !== null) {
        deletions.push({ start: delStart, end: currentOldLine - 1 })
        delStart = null
      }
      currentNewLine++
      currentOldLine++
    }
  }

  // Flush remaining ranges
  if (addStart !== null) {
    additions.push({ start: addStart, end: currentNewLine - 1 })
  }
  if (delStart !== null) {
    deletions.push({ start: delStart, end: currentOldLine - 1 })
  }
}

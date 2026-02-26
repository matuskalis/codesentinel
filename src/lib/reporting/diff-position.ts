/**
 * Maps an absolute line number in the "new" file to a GitHub diff position.
 *
 * GitHub's review-comment API expects a `position` that is a 1-indexed count
 * of lines within the diff patch text. This function walks the patch, tracking
 * which "new file" line each diff line corresponds to, and returns the position
 * when the target line is found. Returns null if the line is not present in the
 * diff (the finding will go into the summary comment only).
 */
export function mapLineToPosition(
  patch: string,
  targetLine: number
): number | null {
  if (!patch) return null

  const lines = patch.split('\n')
  let currentNewLine = 0
  let position = 0

  for (const line of lines) {
    // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkMatch = line.match(
      /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/
    )
    if (hunkMatch) {
      currentNewLine = parseInt(hunkMatch[1], 10) - 1
      position++
      continue
    }

    if (line.startsWith('+')) {
      currentNewLine++
      position++
      if (currentNewLine === targetLine) return position
    } else if (line.startsWith('-')) {
      // Deleted lines don't advance the new-file line counter
      position++
    } else {
      // Context line (space prefix) or empty trailing line
      currentNewLine++
      position++
      if (currentNewLine === targetLine) return position
    }
  }

  return null
}

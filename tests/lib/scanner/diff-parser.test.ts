import { describe, it, expect } from 'vitest'
import { parseDiff } from '@/lib/scanner/diff-parser'

describe('parseDiff', () => {
  describe('single file diff', () => {
    it('should parse a single modified file diff', () => {
      const diff = [
        'diff --git a/src/utils.ts b/src/utils.ts',
        'index abc1234..def5678 100644',
        '--- a/src/utils.ts',
        '+++ b/src/utils.ts',
        '@@ -1,3 +1,4 @@',
        ' const a = 1',
        '+const b = 2',
        ' const c = 3',
        ' const d = 4',
      ].join('\n')

      const files = parseDiff(diff)
      expect(files.length).toBe(1)
      expect(files[0].filePath).toBe('src/utils.ts')
      expect(files[0].status).toBe('modified')
      expect(files[0].additions.length).toBeGreaterThan(0)
    })

    it('should extract the patch starting from @@', () => {
      const diff = [
        'diff --git a/src/utils.ts b/src/utils.ts',
        'index abc1234..def5678 100644',
        '--- a/src/utils.ts',
        '+++ b/src/utils.ts',
        '@@ -1,3 +1,4 @@',
        ' const a = 1',
        '+const b = 2',
        ' const c = 3',
      ].join('\n')

      const files = parseDiff(diff)
      expect(files[0].patch).toBeDefined()
      expect(files[0].patch!.startsWith('@@')).toBe(true)
    })
  })

  describe('multi-file diff', () => {
    it('should parse multiple files from a single diff', () => {
      const diff = [
        'diff --git a/src/a.ts b/src/a.ts',
        'index abc1234..def5678 100644',
        '--- a/src/a.ts',
        '+++ b/src/a.ts',
        '@@ -1,2 +1,3 @@',
        ' line1',
        '+line2',
        ' line3',
        'diff --git a/src/b.ts b/src/b.ts',
        'index abc1234..def5678 100644',
        '--- a/src/b.ts',
        '+++ b/src/b.ts',
        '@@ -1,2 +1,3 @@',
        ' line1',
        '+line2',
        ' line3',
        'diff --git a/src/c.ts b/src/c.ts',
        'index abc1234..def5678 100644',
        '--- a/src/c.ts',
        '+++ b/src/c.ts',
        '@@ -1,2 +1,3 @@',
        ' line1',
        '+line2',
        ' line3',
      ].join('\n')

      const files = parseDiff(diff)
      expect(files.length).toBe(3)
      expect(files[0].filePath).toBe('src/a.ts')
      expect(files[1].filePath).toBe('src/b.ts')
      expect(files[2].filePath).toBe('src/c.ts')
    })
  })

  describe('added file', () => {
    it('should detect new file mode as added status', () => {
      const diff = [
        'diff --git a/src/new-file.ts b/src/new-file.ts',
        'new file mode 100644',
        'index 0000000..abc1234',
        '--- /dev/null',
        '+++ b/src/new-file.ts',
        '@@ -0,0 +1,3 @@',
        '+const a = 1',
        '+const b = 2',
        '+const c = 3',
      ].join('\n')

      const files = parseDiff(diff)
      expect(files.length).toBe(1)
      expect(files[0].status).toBe('added')
      expect(files[0].filePath).toBe('src/new-file.ts')
      expect(files[0].additions.length).toBeGreaterThan(0)
    })
  })

  describe('deleted file', () => {
    it('should detect deleted file mode as deleted status', () => {
      const diff = [
        'diff --git a/src/old-file.ts b/src/old-file.ts',
        'deleted file mode 100644',
        'index abc1234..0000000',
        '--- a/src/old-file.ts',
        '+++ /dev/null',
        '@@ -1,3 +0,0 @@',
        '-const a = 1',
        '-const b = 2',
        '-const c = 3',
      ].join('\n')

      const files = parseDiff(diff)
      expect(files.length).toBe(1)
      expect(files[0].status).toBe('deleted')
      expect(files[0].deletions.length).toBeGreaterThan(0)
    })
  })

  describe('renamed file', () => {
    it('should detect renamed file when paths differ', () => {
      const diff = [
        'diff --git a/src/old-name.ts b/src/new-name.ts',
        'similarity index 95%',
        'rename from src/old-name.ts',
        'rename to src/new-name.ts',
        'index abc1234..def5678 100644',
        '--- a/src/old-name.ts',
        '+++ b/src/new-name.ts',
        '@@ -1,3 +1,3 @@',
        ' const a = 1',
        '-const b = 2',
        '+const b = 3',
        ' const c = 3',
      ].join('\n')

      const files = parseDiff(diff)
      expect(files.length).toBe(1)
      expect(files[0].status).toBe('renamed')
      expect(files[0].filePath).toBe('src/new-name.ts')
    })
  })

  describe('binary file', () => {
    it('should skip binary files with "Binary files" marker', () => {
      const diff = [
        'diff --git a/image.png b/image.png',
        'index abc1234..def5678 100644',
        'Binary files a/image.png and b/image.png differ',
      ].join('\n')

      const files = parseDiff(diff)
      expect(files.length).toBe(0)
    })

    it('should skip binary files with GIT binary patch marker', () => {
      const diff = [
        'diff --git a/font.woff2 b/font.woff2',
        'index abc1234..def5678 100644',
        'GIT binary patch',
        'literal 1234',
        'abcdef',
      ].join('\n')

      const files = parseDiff(diff)
      expect(files.length).toBe(0)
    })
  })

  describe('empty diff', () => {
    it('should return empty array for empty string', () => {
      const files = parseDiff('')
      expect(files.length).toBe(0)
    })

    it('should return empty array for whitespace only', () => {
      const files = parseDiff('   \n\n  ')
      expect(files.length).toBe(0)
    })
  })

  describe('hunk parsing', () => {
    it('should track addition line ranges correctly', () => {
      const diff = [
        'diff --git a/src/file.ts b/src/file.ts',
        'index abc1234..def5678 100644',
        '--- a/src/file.ts',
        '+++ b/src/file.ts',
        '@@ -1,3 +1,5 @@',
        ' line1',
        '+added1',
        '+added2',
        ' line2',
        ' line3',
      ].join('\n')

      const files = parseDiff(diff)
      expect(files[0].additions.length).toBeGreaterThan(0)
      expect(files[0].additions[0].start).toBe(2)
      expect(files[0].additions[0].end).toBe(3)
    })

    it('should track deletion line ranges correctly', () => {
      const diff = [
        'diff --git a/src/file.ts b/src/file.ts',
        'index abc1234..def5678 100644',
        '--- a/src/file.ts',
        '+++ b/src/file.ts',
        '@@ -1,5 +1,3 @@',
        ' line1',
        '-removed1',
        '-removed2',
        ' line2',
        ' line3',
      ].join('\n')

      const files = parseDiff(diff)
      expect(files[0].deletions.length).toBeGreaterThan(0)
      expect(files[0].deletions[0].start).toBe(2)
      expect(files[0].deletions[0].end).toBe(3)
    })

    it('should handle no-newline-at-end-of-file marker', () => {
      const diff = [
        'diff --git a/src/file.ts b/src/file.ts',
        'index abc1234..def5678 100644',
        '--- a/src/file.ts',
        '+++ b/src/file.ts',
        '@@ -1,2 +1,3 @@',
        ' line1',
        '+added',
        ' line2',
        '\\ No newline at end of file',
      ].join('\n')

      const files = parseDiff(diff)
      expect(files.length).toBe(1)
      expect(files[0].additions.length).toBeGreaterThan(0)
    })
  })
})

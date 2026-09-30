import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { execFileSync } from 'node:child_process'
import { walkDirectory, buildFileChanges } from '@/cli/walker'

let tmpDir: string

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesentinel-walker-'))

  // Standard source files
  fs.writeFileSync(path.join(tmpDir, 'index.ts'), 'export const a = 1;\n')
  fs.writeFileSync(path.join(tmpDir, 'component.tsx'), 'export default function App() { return null; }\n')
  fs.writeFileSync(path.join(tmpDir, 'utils.js'), 'module.exports = {};\n')
  fs.writeFileSync(path.join(tmpDir, 'config.json'), '{ "key": "value" }\n')
  fs.writeFileSync(path.join(tmpDir, 'pipeline.yml'), 'steps:\n  - run: echo hi\n')
  fs.writeFileSync(path.join(tmpDir, 'deploy.yaml'), 'apiVersion: v1\n')
  fs.writeFileSync(path.join(tmpDir, 'esm.mjs'), 'export const x = 1;\n')
  fs.writeFileSync(path.join(tmpDir, 'cjs.cjs'), 'module.exports = {};\n')
  fs.writeFileSync(path.join(tmpDir, 'main.jsx'), 'export default () => null;\n')

  // Env files
  fs.writeFileSync(path.join(tmpDir, '.env'), 'SECRET=abc\n')
  fs.writeFileSync(path.join(tmpDir, '.env.local'), 'LOCAL_SECRET=xyz\n')

  // Files that should NOT be walked (wrong extension)
  fs.writeFileSync(path.join(tmpDir, 'photo.png'), 'fake-binary')
  fs.writeFileSync(path.join(tmpDir, 'image.jpg'), 'fake-binary')
  fs.writeFileSync(path.join(tmpDir, 'readme.md'), '# README\n')
  fs.writeFileSync(path.join(tmpDir, 'styles.css'), 'body { color: red; }\n')

  // Directories that should be skipped
  fs.mkdirSync(path.join(tmpDir, 'node_modules'))
  fs.writeFileSync(path.join(tmpDir, 'node_modules', 'foo.ts'), 'export const nm = 1;\n')

  fs.mkdirSync(path.join(tmpDir, '.git'))
  fs.writeFileSync(path.join(tmpDir, '.git', 'config'), '[core]\n')

  fs.mkdirSync(path.join(tmpDir, 'dist'))
  fs.writeFileSync(path.join(tmpDir, 'dist', 'bundle.js'), 'var a = 1;\n')

  fs.mkdirSync(path.join(tmpDir, '.next'))
  fs.writeFileSync(path.join(tmpDir, '.next', 'server.js'), '// server\n')

  fs.mkdirSync(path.join(tmpDir, 'build'))
  fs.writeFileSync(path.join(tmpDir, 'build', 'output.js'), '// build\n')

  fs.mkdirSync(path.join(tmpDir, 'coverage'))
  fs.writeFileSync(path.join(tmpDir, 'coverage', 'lcov.json'), '{}')

  // Nested directory (should be walked)
  fs.mkdirSync(path.join(tmpDir, 'src'))
  fs.writeFileSync(path.join(tmpDir, 'src', 'nested.ts'), 'export const nested = true;\n')

  // Names that merely contain a skipped word must still be scanned
  fs.mkdirSync(path.join(tmpDir, 'src', 'rebuild'))
  fs.writeFileSync(path.join(tmpDir, 'src', 'rebuild', 'payments.ts'), 'export const rebuilt = true;\n')
  fs.mkdirSync(path.join(tmpDir, 'scripts'))
  fs.writeFileSync(path.join(tmpDir, 'scripts', 'build-invoices.ts'), 'export const invoices = true;\n')
  fs.writeFileSync(path.join(tmpDir, 'src', 'distance.ts'), 'export const distance = 1;\n')

  // Large file for buildFileChanges test (> 512KB)
  const largeContent = 'x'.repeat(513 * 1024) + '\n'
  fs.writeFileSync(path.join(tmpDir, 'large.ts'), largeContent)
})

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('walkDirectory', () => {
  it('should walk typescript and javascript files', () => {
    const results = walkDirectory(tmpDir)
    const basenames = results.map(f => path.basename(f))

    expect(basenames).toContain('index.ts')
    expect(basenames).toContain('component.tsx')
    expect(basenames).toContain('utils.js')
    expect(basenames).toContain('main.jsx')
    expect(basenames).toContain('esm.mjs')
    expect(basenames).toContain('cjs.cjs')
  })

  it('should walk json and yaml files', () => {
    const results = walkDirectory(tmpDir)
    const basenames = results.map(f => path.basename(f))

    expect(basenames).toContain('config.json')
    expect(basenames).toContain('pipeline.yml')
    expect(basenames).toContain('deploy.yaml')
  })

  it('should find .env files', () => {
    const results = walkDirectory(tmpDir)
    const basenames = results.map(f => path.basename(f))

    expect(basenames).toContain('.env')
    expect(basenames).toContain('.env.local')
  })

  it('should skip node_modules directory', () => {
    const results = walkDirectory(tmpDir)
    const hasNodeModules = results.some(f => f.includes('node_modules'))

    expect(hasNodeModules).toBe(false)
  })

  it('should skip .git directory', () => {
    const results = walkDirectory(tmpDir)
    const hasGit = results.some(f => f.includes(path.join('.git', '')))

    expect(hasGit).toBe(false)
  })

  it('should skip dist, build, .next, and coverage directories', () => {
    const skippedDirs = ['dist', 'build', '.next', 'coverage']
    const results = walkDirectory(tmpDir)

    const hasSkipped = results.some(f =>
      path.relative(tmpDir, f).split(path.sep).some(segment => skippedDirs.includes(segment))
    )

    expect(hasSkipped).toBe(false)
  })

  it('should not walk files with non-scannable extensions', () => {
    const results = walkDirectory(tmpDir)
    const basenames = results.map(f => path.basename(f))

    expect(basenames).not.toContain('photo.png')
    expect(basenames).not.toContain('image.jpg')
    expect(basenames).not.toContain('readme.md')
    expect(basenames).not.toContain('styles.css')
  })

  it('should walk files in nested directories', () => {
    const results = walkDirectory(tmpDir)
    const basenames = results.map(f => path.basename(f))

    expect(basenames).toContain('nested.ts')
  })

  it('should return empty array for nonexistent directory', () => {
    const results = walkDirectory(path.join(tmpDir, 'does-not-exist'))

    expect(results).toEqual([])
  })

  it('should return empty array for empty directory', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesentinel-empty-'))
    try {
      const results = walkDirectory(emptyDir)
      expect(results).toEqual([])
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true })
    }
  })

  it('should return absolute paths', () => {
    const results = walkDirectory(tmpDir)

    for (const filePath of results) {
      expect(path.isAbsolute(filePath)).toBe(true)
    }
  })
})

describe('buildFileChanges', () => {
  it('should return FileChange objects with relative paths', () => {
    const files = buildFileChanges(tmpDir)

    for (const file of files) {
      expect(path.isAbsolute(file.filePath)).toBe(false)
    }
  })

  it('should set status to added for all files', () => {
    const files = buildFileChanges(tmpDir)

    for (const file of files) {
      expect(file.status).toBe('added')
    }
  })

  it('should include content for each file', () => {
    const files = buildFileChanges(tmpDir)
    const indexFile = files.find(f => f.filePath === 'index.ts')

    expect(indexFile).toBeDefined()
    expect(indexFile!.content).toBe('export const a = 1;\n')
  })

  it('should include additions line range', () => {
    const files = buildFileChanges(tmpDir)
    const indexFile = files.find(f => f.filePath === 'index.ts')

    expect(indexFile).toBeDefined()
    expect(indexFile!.additions.length).toBeGreaterThan(0)
    expect(indexFile!.additions[0].start).toBe(1)
  })

  it('should skip files larger than 512KB', () => {
    const files = buildFileChanges(tmpDir)
    const largeFile = files.find(f => f.filePath === 'large.ts')

    expect(largeFile).toBeUndefined()
  })

  it('should return empty array for nonexistent directory', () => {
    const files = buildFileChanges(path.join(tmpDir, 'nope'))

    expect(files).toEqual([])
  })

  it('should include nested files with correct relative path', () => {
    const files = buildFileChanges(tmpDir)
    const nestedFile = files.find(f => f.filePath === path.join('src', 'nested.ts'))

    expect(nestedFile).toBeDefined()
    expect(nestedFile!.content).toContain('nested')
  })

  it('should keep files whose path merely contains build or dist', () => {
    const filePaths = buildFileChanges(tmpDir).map(f => f.filePath)

    expect(filePaths).toContain(path.join('src', 'rebuild', 'payments.ts'))
    expect(filePaths).toContain(path.join('scripts', 'build-invoices.ts'))
    expect(filePaths).toContain(path.join('src', 'distance.ts'))
  })
})

describe('buildFileChanges inside a git repository', () => {
  let repoDir: string

  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesentinel-git-'))
    execFileSync('git', ['init', '-q'], { cwd: repoDir, stdio: 'ignore' })
    fs.writeFileSync(path.join(repoDir, '.gitignore'), '.env.local\n.env.production\nlocal-config.json\nvendored/\n')
    fs.writeFileSync(path.join(repoDir, '.env.local'), 'LOCAL_ONLY=1\n')
    fs.writeFileSync(path.join(repoDir, '.env.production'), 'FORCE_ADDED=1\n')
    fs.writeFileSync(path.join(repoDir, '.env'), 'COMMITTED=1\n')
    fs.writeFileSync(path.join(repoDir, 'local-config.json'), '{}\n')
    fs.writeFileSync(path.join(repoDir, 'index.ts'), 'export const a = 1;\n')
    fs.mkdirSync(path.join(repoDir, 'src'))
    fs.writeFileSync(path.join(repoDir, 'src', 'nested.ts'), 'export const nested = true;\n')
    fs.mkdirSync(path.join(repoDir, 'vendored', 'deeper'), { recursive: true })
    fs.writeFileSync(path.join(repoDir, 'vendored', 'leaked.ts'), 'export const leaked = 1;\n')
    fs.writeFileSync(path.join(repoDir, 'vendored', '.env.production'), 'VENDORED=1\n')
    fs.writeFileSync(path.join(repoDir, 'vendored', 'deeper', 'inner.ts'), 'export const inner = 1;\n')
    execFileSync('git', ['add', '-f', '.env.production'], { cwd: repoDir, stdio: 'ignore' })
  })

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true })
  })

  const isIgnored = (files: ReturnType<typeof buildFileChanges>, filePath: string) =>
    files.find(f => f.filePath === filePath)?.gitIgnored

  it('should mark untracked files that .gitignore covers', () => {
    const files = buildFileChanges(repoDir)

    expect(isIgnored(files, '.env.local')).toBe(true)
    expect(isIgnored(files, 'local-config.json')).toBe(true)
  })

  it('should not mark a tracked file even when .gitignore covers it', () => {
    const files = buildFileChanges(repoDir)

    expect(isIgnored(files, '.env.production')).toBe(false)
  })

  it('should not mark files that .gitignore does not cover', () => {
    const files = buildFileChanges(repoDir)

    expect(isIgnored(files, '.env')).toBe(false)
    expect(isIgnored(files, 'index.ts')).toBe(false)
    expect(isIgnored(files, path.join('src', 'nested.ts'))).toBe(false)
  })

  it('should apply the parent repository rules when scanning a subdirectory', () => {
    fs.writeFileSync(path.join(repoDir, 'src', '.env.local'), 'NESTED_LOCAL=1\n')

    const files = buildFileChanges(path.join(repoDir, 'src'))

    expect(isIgnored(files, '.env.local')).toBe(true)
    expect(isIgnored(files, 'nested.ts')).toBe(false)
  })

  it('should mark files inside an ignored directory when the scan root is the project', () => {
    const files = buildFileChanges(repoDir)

    expect(isIgnored(files, path.join('vendored', 'leaked.ts'))).toBe(true)
  })

  it('should not use the signal when the scan root itself is ignored by the parent repository', () => {
    const files = buildFileChanges(path.join(repoDir, 'vendored'))

    expect(files.map(f => f.filePath).sort()).toEqual(['.env.production', path.join('deeper', 'inner.ts'), 'leaked.ts'])
    expect(files.every(f => f.gitIgnored === false)).toBe(true)
  })

  it('should not use the signal when an ancestor of the scan root is ignored', () => {
    const files = buildFileChanges(path.join(repoDir, 'vendored', 'deeper'))

    expect(files.map(f => f.filePath)).toEqual(['inner.ts'])
    expect(files.every(f => f.gitIgnored === false)).toBe(true)
  })

  it('should use the scan root\'s own rules when it is a separate repository inside an ignored directory', () => {
    const nestedDir = path.join(repoDir, 'vendored', 'nested-repo')
    fs.mkdirSync(nestedDir)
    execFileSync('git', ['init', '-q'], { cwd: nestedDir, stdio: 'ignore' })
    fs.writeFileSync(path.join(nestedDir, '.gitignore'), '.env.local\n')
    fs.writeFileSync(path.join(nestedDir, '.env.local'), 'NESTED=1\n')
    fs.writeFileSync(path.join(nestedDir, 'app.ts'), 'export const app = 1;\n')

    const files = buildFileChanges(nestedDir)

    expect(isIgnored(files, '.env.local')).toBe(true)
    expect(isIgnored(files, 'app.ts')).toBe(false)
  })

  it('should mark nothing outside a git repository', () => {
    const files = buildFileChanges(tmpDir)

    expect(files.length).toBeGreaterThan(0)
    expect(files.every(f => !f.gitIgnored)).toBe(true)
  })
})

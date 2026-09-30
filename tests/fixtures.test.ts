import { describe, it, expect, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { runScan } from '@/lib/scanner/index'
import type { FileChange } from '@/types'
import {
  FIXTURES_DIR,
  discoverFixtureNames,
  loadExpected,
  scanFixture,
  sortFindings,
} from './fixture-runner'

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
  createScanLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  createCorrelationLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('Layer A fixture regression', () => {
  const fixtureNames = discoverFixtureNames()

  it('has an expected file for every fixture directory and the other way round', () => {
    const fixtureDirs = fs.readdirSync(FIXTURES_DIR, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort()

    expect(fixtureNames).toEqual(fixtureDirs)
  })

  describe('all fixtures match expected output', () => {
    for (const fixtureName of fixtureNames) {
      it(`fixture: ${fixtureName}`, async () => {
        const actual = sortFindings(await scanFixture(fixtureName))
        const expected = sortFindings(loadExpected(fixtureName))

        expect(actual).toEqual(expected)
      })
    }
  })

  it('scanner output is deterministic (identical on re-run)', async () => {
    for (const fixtureName of fixtureNames) {
      const run1 = sortFindings(await scanFixture(fixtureName))
      const run2 = sortFindings(await scanFixture(fixtureName))

      expect(run1).toEqual(run2)
    }
  })

  it('line numbers shift when content changes', async () => {
    const fixturePath = path.join(FIXTURES_DIR, 'next-supabase-service-key-client', 'app', 'page.tsx')
    const originalContent = fs.readFileSync(fixturePath, 'utf-8')
    const modifiedContent = '\n\n' + originalContent
    const lineCount = modifiedContent.split('\n').length

    const file: FileChange = {
      filePath: 'app/page.tsx',
      status: 'added',
      content: modifiedContent,
      additions: [{ start: 1, end: lineCount }],
      deletions: [],
    }

    const result = await runScan([file], [])
    const finding = result.findings.find(f => f.ruleId === 'supabase-service-key-client')

    expect(finding).toBeDefined()
    expect(finding!.startLine).toBe(9)
  })
})

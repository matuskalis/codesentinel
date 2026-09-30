import { describe, it, expect } from 'vitest'
import { DEFAULT_SCAN_LIMITS, directoryScanLimits, shouldSkipFile } from '@/lib/scan-limits'

describe('shouldSkipFile', () => {
  describe('skips generated, vendored and binary paths', () => {
    it.each([
      'node_modules/stripe/index.ts',
      'packages/web/node_modules/stripe/index.ts',
      'dist/bundle.js',
      'packages/web/dist/index.js',
      'build/output.js',
      'apps/site/build/server.js',
      '.next/server/app/page.js',
      'coverage/lcov.json',
      'pnpm-lock.yaml',
      'apps/web/pnpm-lock.yaml',
      'package-lock.json',
      'yarn.lock',
      'public/app.min.js',
      'public/app.min.css',
      'dist-types/index.d.ts.map',
      'public/logo.svg',
      'public/fonts/inter.woff2',
      'docs/manual.pdf',
      'packages\\web\\dist\\index.js',
    ])('skips %s', filePath => {
      expect(shouldSkipFile(filePath, DEFAULT_SCAN_LIMITS)).toBe(true)
    })
  })

  describe('keeps source files whose names merely contain a skip word', () => {
    it.each([
      'src/rebuild/payments.ts',
      'scripts/build-invoices.ts',
      'src/lib/distance.ts',
      'src/app/api/distribute/route.ts',
      'src/lib/coverage-report.ts',
      'src/.nextra/config.ts',
      'src/lib/yarn.lock.ts',
      'src/lib/not-a-lockfile.json',
      'src/lib/minify.ts',
      'src/lib/app.min.ts',
      'src/lib/sourcemap.ts',
    ])('keeps %s', filePath => {
      expect(shouldSkipFile(filePath, DEFAULT_SCAN_LIMITS)).toBe(false)
    })
  })

  it('uses the limits it is given instead of the defaults', () => {
    const limits = { ...DEFAULT_SCAN_LIMITS, skipPatterns: ['generated', '*.snap'] }

    expect(shouldSkipFile('src/generated/client.ts', limits)).toBe(true)
    expect(shouldSkipFile('src/__snapshots__/app.snap', limits)).toBe(true)
    expect(shouldSkipFile('node_modules/stripe/index.ts', limits)).toBe(false)
  })
})

describe('directoryScanLimits', () => {
  it('has no file cap and keeps the default time limit', () => {
    const limits = directoryScanLimits({})

    expect(limits.maxFilesPerScan).toBe(Number.POSITIVE_INFINITY)
    expect(limits.scanTimeoutMs).toBe(DEFAULT_SCAN_LIMITS.scanTimeoutMs)
  })

  it('reads the time limit from CODESENTINEL_SCAN_TIMEOUT_MS', () => {
    expect(directoryScanLimits({ CODESENTINEL_SCAN_TIMEOUT_MS: '600000' }).scanTimeoutMs).toBe(600000)
    expect(directoryScanLimits({ CODESENTINEL_SCAN_TIMEOUT_MS: '0' }).scanTimeoutMs).toBe(0)
  })

  it('treats an empty value as unset', () => {
    expect(directoryScanLimits({ CODESENTINEL_SCAN_TIMEOUT_MS: '' }).scanTimeoutMs).toBe(DEFAULT_SCAN_LIMITS.scanTimeoutMs)
  })

  it.each(['abc', '-5', '1.5', '10s', ' 10 '])('rejects %j instead of ignoring it', value => {
    expect(() => directoryScanLimits({ CODESENTINEL_SCAN_TIMEOUT_MS: value })).toThrow(
      /CODESENTINEL_SCAN_TIMEOUT_MS must be a whole number of milliseconds/
    )
  })
})
